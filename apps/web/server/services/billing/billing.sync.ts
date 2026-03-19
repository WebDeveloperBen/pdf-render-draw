import type Stripe from "stripe"
import { and, eq, isNull, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../../utils/drizzle"
import * as schema from "#shared/db/schema"
import { stripeClient } from "@auth"
import { billingService } from "./billing.service"
import { parseLimitsFromMetadata } from "./billing.helpers"
import { getTestState } from "../../utils/test-state"

const BILLING_SYNC_LOCK_NAMESPACE = 18451
const BILLING_SYNC_LOCK_KEY = 1

type SyncResult = {
  synced: number
  created: number
  updated: number
  errors: number
  duration: number
}

type PlanVariant = {
  price: Stripe.Price
  product: Stripe.Product
}

type CachedPlan = typeof schema.stripePlan.$inferSelect

type ResolvedSubscriptionItem = {
  plan: CachedPlan | null
  planItem: Stripe.SubscriptionItem
  seats: number | null
}

function isLocalOnlyPlanVariant(variant: PlanVariant): boolean {
  const name = variant.product.name.trim().toLowerCase()
  const lookupKey = variant.price.lookup_key?.trim().toLowerCase()
  const metadata = { ...variant.product.metadata, ...variant.price.metadata }

  return (
    (variant.price.unit_amount ?? 0) === 0 ||
    name === "free" ||
    lookupKey === "free" ||
    metadata.plan_scope === "local" ||
    metadata.billing_managed === "false"
  )
}

function getExpandedProduct(price: Stripe.Price): Stripe.Product | null {
  const product = price.product
  if (!price.recurring || typeof product === "string" || !product || product.deleted) {
    return null
  }

  return product
}

function getDefaultPriceId(product: Stripe.Product): string | null {
  if (!product.default_price) return null
  return typeof product.default_price === "string" ? product.default_price : product.default_price.id
}

function selectVariantForInterval(variants: PlanVariant[], interval: "month" | "year"): PlanVariant | null {
  const matches = variants.filter((variant) => variant.price.recurring?.interval === interval)
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]!

  const defaultPriceId = getDefaultPriceId(matches[0]!.product)
  if (defaultPriceId) {
    const defaultVariant = matches.find((variant) => variant.price.id === defaultPriceId)
    if (defaultVariant) return defaultVariant
  }

  const labelledPrimary = matches.filter((variant) => (variant.price.metadata?.billing_primary ?? "") === "true")
  if (labelledPrimary.length === 1) return labelledPrimary[0]!

  throw new Error(
    `Multiple active ${interval} prices found for Stripe product ${matches[0]!.product.id}. Mark one as the default Stripe price or set price metadata billing_primary=true.`
  )
}

function selectPrimaryVariant(variants: PlanVariant[]): PlanVariant {
  const monthly = selectVariantForInterval(variants, "month")
  if (monthly) return monthly

  const yearly = selectVariantForInterval(variants, "year")
  if (yearly) return yearly

  throw new Error(`No supported recurring price found for Stripe product ${variants[0]?.product.id ?? "unknown"}`)
}

function selectAnnualVariant(variants: PlanVariant[], primary: PlanVariant): PlanVariant | null {
  const annual = selectVariantForInterval(variants, "year")
  if (!annual || annual.price.id === primary.price.id) return null
  return annual
}

async function resolveSubscriptionItem(items: Stripe.SubscriptionItem[]): Promise<ResolvedSubscriptionItem | null> {
  if (items.length === 0) return null

  const plans = await db.query.stripePlan.findMany()

  for (const item of items) {
    const plan = plans.find((candidate) => {
      return candidate.stripePriceId === item.price.id || candidate.annualDiscountPriceId === item.price.id
    })

    if (!plan) continue

    return {
      plan,
      planItem: item,
      seats: item.quantity ?? null
    }
  }

  if (items.length === 1) {
    return {
      plan: null,
      planItem: items[0]!,
      seats: items[0]!.quantity ?? null
    }
  }

  return null
}

async function acquireBillingSyncLock(): Promise<boolean> {
  const result = await db.execute(sql`
    select pg_try_advisory_lock(${BILLING_SYNC_LOCK_NAMESPACE}, ${BILLING_SYNC_LOCK_KEY}) as locked
  `)

  return Boolean(result.rows.at(0)?.locked)
}

async function releaseBillingSyncLock(): Promise<void> {
  await db.execute(sql`
    select pg_advisory_unlock(${BILLING_SYNC_LOCK_NAMESPACE}, ${BILLING_SYNC_LOCK_KEY})
  `)
}

export const billingSyncService = {
  /**
   * Full sync: pull all subscriptions and plans from Stripe into local DB.
   * Synchronous — admin waits for the result.
   */
  async fullSync(triggeredBy: string): Promise<SyncResult> {
    const startTime = Date.now()
    let syncLogId: string | null = null
    let hasLock = false

    let synced = 0
    let created = 0
    let updated = 0
    let errors = 0

    try {
      hasLock = await acquireBillingSyncLock()
      if (!hasLock) {
        throw createError({ statusCode: 409, message: "Stripe sync already in progress" })
      }

      syncLogId = nanoid()
      await db.insert(schema.billingSyncLog).values({
        id: syncLogId,
        type: "full",
        status: "in_progress",
        triggeredBy,
        startedAt: new Date()
      })

      const testState = getTestState()
      if (testState?.billing.fullSyncResult) {
        const duration = testState.billing.fullSyncResult.duration
        await db
          .update(schema.billingSyncLog)
          .set({
            status: testState.billing.fullSyncResult.errors > 0 ? "partial" : "success",
            subscriptionsSynced: testState.billing.fullSyncResult.synced,
            subscriptionsCreated: testState.billing.fullSyncResult.created,
            subscriptionsUpdated: testState.billing.fullSyncResult.updated,
            errors: testState.billing.fullSyncResult.errors,
            duration,
            completedAt: new Date()
          })
          .where(eq(schema.billingSyncLog.id, syncLogId))

        return testState.billing.fullSyncResult
      }

      await this.syncPlans()

      let hasMore = true
      let startingAfter: string | undefined

      while (hasMore) {
        const params: Stripe.SubscriptionListParams = {
          limit: 100,
          expand: ["data.customer", "data.items.data.price.product"]
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
        const lastSubscription = stripeSubscriptions.data.at(-1)
        if (lastSubscription) {
          startingAfter = lastSubscription.id
        }
      }

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
      if (syncLogId) {
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
      }

      throw err
    } finally {
      if (hasLock) {
        try {
          await releaseBillingSyncLock()
        } catch (err) {
          console.error("[BillingSync] Failed to release advisory lock:", err)
        }
      }
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

    const testState = getTestState()
    if (testState?.billing.refreshStatus) {
      await db
        .update(schema.subscription)
        .set({ status: testState.billing.refreshStatus })
        .where(eq(schema.subscription.id, localSub.id))
    } else {
      const stripeSub = await stripeClient.subscriptions.retrieve(localSub.stripeSubscriptionId, {
        expand: ["items.data.price.product"]
      })
      await this.upsertSubscription(stripeSub)
    }

    await billingService.recordActivity({
      subscriptionId: localSub.id,
      type: "sync",
      description: "Subscription refreshed from Stripe",
      actorId: adminId,
      metadata: { stripeSubscriptionId: localSub.stripeSubscriptionId }
    })
  },

  async listAllActiveRecurringPrices(): Promise<PlanVariant[]> {
    const variants: PlanVariant[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params: Stripe.PriceListParams = {
        active: true,
        expand: ["data.product"],
        limit: 100
      }
      if (startingAfter) {
        params.starting_after = startingAfter
      }

      const response = await stripeClient.prices.list(params)
      for (const price of response.data) {
        const product = getExpandedProduct(price)
        if (!product) continue

        const variant = { price, product }
        if (isLocalOnlyPlanVariant(variant)) continue

        variants.push(variant)
      }

      hasMore = response.has_more
      const lastPrice = response.data.at(-1)
      if (lastPrice) {
        startingAfter = lastPrice.id
      }
    }

    return variants
  },

  /**
   * Sync Stripe products and prices into the local stripe_plan cache.
   *
   * One logical row is stored per Stripe product. Monthly pricing is stored in
   * stripePriceId and the annual variant, if present, is stored in
   * annualDiscountPriceId so the rest of the app does not see duplicate plans.
   */
  async syncPlans() {
    const variants = await this.listAllActiveRecurringPrices()
    const plansByProduct = new Map<string, PlanVariant[]>()

    for (const variant of variants) {
      const existing = plansByProduct.get(variant.product.id)
      if (existing) existing.push(variant)
      else plansByProduct.set(variant.product.id, [variant])
    }

    for (const [productId, productVariants] of plansByProduct.entries()) {
      const primaryVariant = selectPrimaryVariant(productVariants)
      const annualVariant = selectAnnualVariant(productVariants, primaryVariant)
      const { product, price } = primaryVariant

      const mergedMetadata = { ...product.metadata, ...price.metadata } as Record<string, unknown>
      const parsedLimits = parseLimitsFromMetadata(mergedMetadata as Record<string, string>)
      const existing = await db.query.stripePlan.findFirst({
        where: eq(schema.stripePlan.stripeProductId, productId)
      })

      const stripeValues = {
        stripeProductId: product.id,
        stripePriceId: price.id,
        name: product.name,
        description: product.description ?? null,
        amount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring?.interval ?? "month",
        active: product.active && price.active,
        annualDiscountPriceId: annualVariant?.price.id ?? null,
        lookupKey: price.lookup_key ?? null,
        metadata: mergedMetadata,
        lastSyncedAt: new Date()
      }

      await db
        .insert(schema.stripePlan)
        .values({
          id: existing?.id ?? nanoid(),
          ...stripeValues,
          limits: existing?.limits ?? parsedLimits,
          trialDays: existing?.trialDays ?? null,
          group: existing?.group ?? null,
          createdAt: existing?.createdAt ?? new Date()
        })
        .onConflictDoUpdate({
          target: schema.stripePlan.stripeProductId,
          set: stripeValues
        })

      await db
        .update(schema.stripePlan)
        .set({ limits: parsedLimits })
        .where(and(eq(schema.stripePlan.stripeProductId, productId), isNull(schema.stripePlan.limits)))
    }

    const activeProductIds = new Set(plansByProduct.keys())
    const allLocalPlans = await db.query.stripePlan.findMany()

    for (const localPlan of allLocalPlans) {
      if (!activeProductIds.has(localPlan.stripeProductId) && localPlan.active) {
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
    const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id

    const org = await db.query.organization.findFirst({
      where: eq(schema.organization.stripeCustomerId, customerId)
    })

    const referenceId = org?.id ?? customerId

    const existing = await db.query.subscription.findFirst({
      where: eq(schema.subscription.stripeSubscriptionId, stripeSub.id)
    })

    const resolvedItem = await resolveSubscriptionItem(stripeSub.items.data)
    if (!resolvedItem) {
      throw new Error(`Unable to resolve plan item for Stripe subscription ${stripeSub.id}`)
    }

    const { plan: matchedPlan, planItem } = resolvedItem
    const priceId = planItem.price.id ?? null
    const plan =
      matchedPlan?.name ??
      (planItem.price.product as Stripe.Product | undefined)?.name ??
      planItem.price.lookup_key ??
      "unknown"

    const values = {
      plan,
      referenceId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSub.id,
      stripePriceId: priceId,
      status: stripeSub.status,
      periodStart: planItem.current_period_start ? new Date(planItem.current_period_start * 1000) : null,
      periodEnd: planItem.current_period_end ? new Date(planItem.current_period_end * 1000) : null,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
      canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      endedAt: stripeSub.ended_at ? new Date(stripeSub.ended_at * 1000) : null,
      seats: resolvedItem.seats,
      trialStart: stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000) : null,
      trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      billingInterval: planItem.price?.recurring?.interval ?? null,
      stripeScheduleId: typeof stripeSub.schedule === "string" ? stripeSub.schedule : (stripeSub.schedule?.id ?? null)
    }

    await db
      .insert(schema.subscription)
      .values({
        id: existing?.id ?? nanoid(),
        ...values
      })
      .onConflictDoUpdate({
        target: schema.subscription.stripeSubscriptionId,
        set: values
      })

    return existing ? "updated" : "created"
  }
}
