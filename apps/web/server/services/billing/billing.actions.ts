import { eq } from "drizzle-orm"
import { db } from "../../utils/drizzle"
import * as schema from "@shared/db/schema"
import { stripeClient } from "@auth"
import { billingService } from "./billing.service"
import { logAdminAction } from "../../utils/audit"

export const billingActionsService = {
  /**
   * Cancel a subscription at period end or immediately.
   */
  async cancelSubscription(params: {
    subscriptionId: string
    mode: "at_period_end" | "immediately"
    reason: string
    adminId: string
    ipAddress?: string | null
    userAgent?: string | null
  }) {
    const localSub = await db.query.subscription.findFirst({
      where: eq(schema.subscription.id, params.subscriptionId)
    })

    if (!localSub?.stripeSubscriptionId) {
      throw createError({ statusCode: 404, message: "Subscription not found or has no Stripe ID" })
    }

    let stripeSub
    if (params.mode === "at_period_end") {
      stripeSub = await stripeClient.subscriptions.update(localSub.stripeSubscriptionId, {
        cancel_at_period_end: true
      })
    } else {
      stripeSub = await stripeClient.subscriptions.cancel(localSub.stripeSubscriptionId)
    }

    // Update local record
    await db
      .update(schema.subscription)
      .set({
        status: stripeSub.status,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        cancelAt: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
        canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
        endedAt: stripeSub.ended_at ? new Date(stripeSub.ended_at * 1000) : null
      })
      .where(eq(schema.subscription.id, localSub.id))

    // Record billing activity
    await billingService.recordActivity({
      subscriptionId: localSub.id,
      type: "admin_action",
      description:
        params.mode === "at_period_end"
          ? `Subscription scheduled for cancellation at period end. Reason: ${params.reason}`
          : `Subscription cancelled immediately. Reason: ${params.reason}`,
      actorId: params.adminId,
      metadata: {
        mode: params.mode,
        reason: params.reason,
        stripeSubscriptionId: localSub.stripeSubscriptionId
      }
    })

    // Audit log
    await logAdminAction({
      adminId: params.adminId,
      actionType: "billing.subscription.cancel",
      targetOrgId: localSub.referenceId,
      metadata: {
        subscriptionId: localSub.id,
        stripeSubscriptionId: localSub.stripeSubscriptionId,
        mode: params.mode,
        reason: params.reason,
        newStatus: stripeSub.status
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    })
  },

  /**
   * Reactivate a subscription that was scheduled for cancellation at period end.
   */
  async reactivateSubscription(params: {
    subscriptionId: string
    reason: string
    adminId: string
    ipAddress?: string | null
    userAgent?: string | null
  }) {
    const localSub = await db.query.subscription.findFirst({
      where: eq(schema.subscription.id, params.subscriptionId)
    })

    if (!localSub?.stripeSubscriptionId) {
      throw createError({ statusCode: 404, message: "Subscription not found or has no Stripe ID" })
    }

    if (!localSub.cancelAtPeriodEnd) {
      throw createError({ statusCode: 400, message: "Subscription is not scheduled for cancellation" })
    }

    const stripeSub = await stripeClient.subscriptions.update(localSub.stripeSubscriptionId, {
      cancel_at_period_end: false
    })

    // Update local record
    await db
      .update(schema.subscription)
      .set({
        status: stripeSub.status,
        cancelAtPeriodEnd: false,
        cancelAt: null,
        canceledAt: null
      })
      .where(eq(schema.subscription.id, localSub.id))

    // Record billing activity
    await billingService.recordActivity({
      subscriptionId: localSub.id,
      type: "admin_action",
      description: `Scheduled cancellation reversed. Reason: ${params.reason}`,
      actorId: params.adminId,
      metadata: {
        reason: params.reason,
        stripeSubscriptionId: localSub.stripeSubscriptionId
      }
    })

    // Audit log
    await logAdminAction({
      adminId: params.adminId,
      actionType: "billing.subscription.reactivate",
      targetOrgId: localSub.referenceId,
      metadata: {
        subscriptionId: localSub.id,
        stripeSubscriptionId: localSub.stripeSubscriptionId,
        reason: params.reason
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    })
  },

  /**
   * Generate a billing portal link and return it (for admin to send to customer).
   */
  async generateBillingPortalLink(params: {
    subscriptionId: string
    returnUrl: string
    adminId: string
    ipAddress?: string | null
    userAgent?: string | null
  }): Promise<string> {
    const localSub = await db.query.subscription.findFirst({
      where: eq(schema.subscription.id, params.subscriptionId)
    })

    if (!localSub?.stripeCustomerId) {
      throw createError({ statusCode: 404, message: "Subscription not found or has no Stripe customer" })
    }

    const session = await stripeClient.billingPortal.sessions.create({
      customer: localSub.stripeCustomerId,
      return_url: params.returnUrl
    })

    // Record billing activity
    await billingService.recordActivity({
      subscriptionId: localSub.id,
      type: "admin_action",
      description: "Billing portal link generated",
      actorId: params.adminId,
      metadata: { stripeSubscriptionId: localSub.stripeSubscriptionId }
    })

    // Audit log
    await logAdminAction({
      adminId: params.adminId,
      actionType: "billing.portal_link_generated",
      targetOrgId: localSub.referenceId,
      metadata: {
        subscriptionId: localSub.id,
        stripeCustomerId: localSub.stripeCustomerId
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    })

    return session.url
  }
}
