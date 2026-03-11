import type Stripe from "stripe"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../drizzle"
import * as schema from "@shared/db/schema"
import { stripeClient } from "@auth"
import { billingService } from "./billing.service"

export const billingSyncService = {
  /**
   * Full sync: pull all subscriptions and plans from Stripe into local DB.
   * Synchronous — admin waits for the result.
   */
  async fullSync(triggeredBy: string): Promise<{
    synced: number
    created: number
    updated: number
    errors: number
    duration: number
  }> {
    const startTime = Date.now()

    // Create sync log entry
    const syncLogId = nanoid()
    await db.insert(schema.billingSyncLog).values({
      id: syncLogId,
      type: "full",
      status: "in_progress",
      triggeredBy,
      startedAt: new Date()
    })

    let synced = 0
    let created = 0
    let updated = 0
    let errors = 0

    try {
      // Sync plans/prices first
      await this.syncPlans()

      // Paginate through all Stripe subscriptions
      let hasMore = true
      let startingAfter: string | undefined

      while (hasMore) {
        const params: Stripe.SubscriptionListParams = {
          limit: 100,
          expand: ["data.customer"]
        }
        if (startingAfter) {
          params.starting_after = startingAfter
        }

        const stripeSubscriptions = await stripeClient.subscriptions.list(params)

        for (const stripeSub of stripeSubscriptions.data) {
          try {
            const result = await this.upsertSubscription(stripeSub)
            synced++
            if (result === "created") created++
            else updated++
          } catch (err) {
            errors++
            console.error(`[BillingSync] Failed to sync subscription ${stripeSub.id}:`, err)
          }
        }

        hasMore = stripeSubscriptions.has_more
        if (stripeSubscriptions.data.length > 0) {
          startingAfter = stripeSubscriptions.data[stripeSubscriptions.data.length - 1].id
        }
      }

      // Update sync log
      const duration = Date.now() - startTime
      await db
        .update(schema.billingSyncLog)
        .set({
          status: errors > 0 ? "partial" : "success",
          subscriptionsSynced: synced,
          subscriptionsCreated: created,
          subscriptionsUpdated: updated,
          errors,
          duration,
          completedAt: new Date()
        })
        .where(eq(schema.billingSyncLog.id, syncLogId))

      return { synced, created, updated, errors, duration }
    } catch (err) {
      const duration = Date.now() - startTime
      await db
        .update(schema.billingSyncLog)
        .set({
          status: "failed",
          subscriptionsSynced: synced,
          subscriptionsCreated: created,
          subscriptionsUpdated: updated,
          errors,
          errorDetails: err instanceof Error ? err.message : String(err),
          duration,
          completedAt: new Date()
        })
        .where(eq(schema.billingSyncLog.id, syncLogId))

      throw err
    }
  },

  /**
   * Refresh a single subscription from Stripe.
   */
  async refreshSubscription(subscriptionId: string, adminId: string) {
    const localSub = await db.query.subscription.findFirst({
      where: eq(schema.subscription.id, subscriptionId)
    })

    if (!localSub?.stripeSubscriptionId) {
      throw createError({ statusCode: 404, message: "Subscription not found or has no Stripe ID" })
    }

    const stripeSub = await stripeClient.subscriptions.retrieve(localSub.stripeSubscriptionId)

    await this.upsertSubscription(stripeSub)

    // Record activity
    await billingService.recordActivity({
      subscriptionId: localSub.id,
      type: "sync",
      description: "Subscription refreshed from Stripe",
      actorId: adminId,
      metadata: { stripeSubscriptionId: stripeSub.id }
    })
  },

  /**
   * Sync Stripe products and prices into the local stripe_plan cache.
   *
   * Only updates Stripe-sourced fields (name, description, amount, currency, interval, active, metadata).
   * App-managed fields (limits, trialDays, annualDiscountPriceId, lookupKey, group) are preserved
   * so admin-configured values aren't overwritten by a sync.
   */
  async syncPlans() {
    // Fetch all active prices with product expanded
    const prices = await stripeClient.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 100
    })

    for (const price of prices.data) {
      const product = price.product as Stripe.Product
      if (!product || typeof product === "string" || product.deleted) continue

      // Only sync recurring prices (subscriptions), skip one-off prices
      if (!price.recurring) continue

      const existing = await db.query.stripePlan.findFirst({
        where: eq(schema.stripePlan.stripePriceId, price.id)
      })

      // Stripe-sourced fields only — app-managed fields are NOT included here
      const stripeValues = {
        stripeProductId: product.id,
        stripePriceId: price.id,
        name: product.name,
        description: product.description ?? null,
        amount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring.interval,
        active: product.active && price.active,
        metadata: { ...product.metadata, ...price.metadata } as Record<string, unknown>,
        lastSyncedAt: new Date()
      }

      if (existing) {
        // Update only Stripe-sourced fields, preserve app-managed fields
        await db
          .update(schema.stripePlan)
          .set(stripeValues)
          .where(eq(schema.stripePlan.id, existing.id))
      } else {
        // New plan — create with Stripe fields, app-managed fields default to null
        await db.insert(schema.stripePlan).values({
          id: nanoid(),
          ...stripeValues,
          // App-managed fields start as null — admin configures them after sync
          annualDiscountPriceId: null,
          lookupKey: price.lookup_key ?? null,
          limits: null,
          trialDays: null,
          group: null,
          createdAt: new Date()
        })
      }
    }

    // Also mark inactive prices — if a Stripe price is deactivated, update our record
    const allLocalPlans = await db.query.stripePlan.findMany()
    const activePriceIds = new Set(
      prices.data
        .filter((p) => p.recurring && typeof p.product !== "string" && !(p.product as Stripe.Product).deleted)
        .map((p) => p.id)
    )

    for (const localPlan of allLocalPlans) {
      if (!activePriceIds.has(localPlan.stripePriceId) && localPlan.active) {
        await db
          .update(schema.stripePlan)
          .set({ active: false, lastSyncedAt: new Date() })
          .where(eq(schema.stripePlan.id, localPlan.id))
      }
    }
  },

  /**
   * Upsert a Stripe subscription into the local DB.
   * Returns "created" or "updated".
   */
  async upsertSubscription(stripeSub: Stripe.Subscription): Promise<"created" | "updated"> {
    // Resolve the customer/org reference
    const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id

    // Find the org by stripeCustomerId
    const org = await db.query.organization.findFirst({
      where: eq(schema.organization.stripeCustomerId, customerId)
    })

    const referenceId = org?.id ?? customerId // Fall back to customer ID if org not linked

    // Check for existing local subscription
    const existing = await db.query.subscription.findFirst({
      where: eq(schema.subscription.stripeSubscriptionId, stripeSub.id)
    })

    const item = stripeSub.items.data[0]
    const plan = (item?.price?.product as Stripe.Product)?.name
      ?? item?.price?.lookup_key
      ?? "unknown"

    const values = {
      plan,
      referenceId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSub.id,
      status: stripeSub.status,
      // In Stripe SDK v20+, current_period is on the item level
      periodStart: item?.current_period_start ? new Date(item.current_period_start * 1000) : null,
      periodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      endedAt: stripeSub.ended_at ? new Date(stripeSub.ended_at * 1000) : null,
      seats: item?.quantity ?? null,
      trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : null,
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      billingInterval: item?.price?.recurring?.interval ?? null,
      stripeScheduleId: typeof stripeSub.schedule === "string" ? stripeSub.schedule : stripeSub.schedule?.id ?? null
    }

    if (existing) {
      await db
        .update(schema.subscription)
        .set(values)
        .where(eq(schema.subscription.id, existing.id))
      return "updated"
    } else {
      await db.insert(schema.subscription).values({
        id: nanoid(),
        ...values
      })
      return "created"
    }
  }
}
