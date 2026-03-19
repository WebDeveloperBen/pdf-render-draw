import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"
import { eq, and, gt } from "drizzle-orm"
import { nanoid } from "nanoid"
import { useRuntimeConfig } from "#imports"
import { db } from "../server/utils/drizzle"
import * as schema from "../shared/db/schema"

export const stripeClient = new Stripe(process.env.NUXT_STRIPE_SECRET_KEY!)

export const stripePlugin = stripe({
  stripeClient,
  stripeWebhookSecret: process.env.NUXT_STRIPE_WEBHOOK_SECRET!,
  createCustomerOnSignUp: false,
  organization: {
    enabled: true
  },
  subscription: {
    enabled: true,
    // Dynamic plans — loaded from the stripe_plan table on each subscription action.
    // Populate via admin "Sync from Stripe" or seed script.
    plans: async () => {
      const runtimeConfig = useRuntimeConfig()
      const freeTrialPeriodInDays = runtimeConfig.sales.freeTrialPeriodInDays
      const plans = await db.query.stripePlan.findMany({
        where: and(eq(schema.stripePlan.active, true), gt(schema.stripePlan.amount, 0))
      })

      return plans.map((plan) => ({
        name: plan.name.toLowerCase(),
        priceId: plan.stripePriceId,
        annualDiscountPriceId: plan.annualDiscountPriceId ?? undefined,
        lookupKey: plan.lookupKey ?? undefined,
        limits: (plan.limits as Record<string, number>) ?? undefined,
        group: plan.group ?? undefined,
        ...(freeTrialPeriodInDays > 0 ? { freeTrial: { days: freeTrialPeriodInDays } } : {})
      }))
    },
    authorizeReference: async ({ user, referenceId }) => {
      // Only org owners and admins can manage billing
      const orgMember = await db.query.member.findFirst({
        where: and(eq(schema.member.userId, user.id), eq(schema.member.organizationId, referenceId))
      })
      return orgMember?.role === "owner" || orgMember?.role === "admin"
    }
  },
  onEvent: async (event) => {
    // Handle invoice events for billing activity tracking
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.finalized"
    ) {
      const invoice = event.data.object as any
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : (invoice.subscription as { id?: string })?.id

      if (subscriptionId) {
        const sub = await db.query.subscription.findFirst({
          where: eq(schema.subscription.stripeSubscriptionId, subscriptionId)
        })

        if (!sub) {
          console.warn(`[Stripe] No local subscription found for ${subscriptionId} (event: ${event.id})`)
          return
        }

        const amountPaid = Number(invoice.amount_paid || 0)
        const amountDue = Number(invoice.amount_due || 0)
        const currency = String(invoice.currency || "aud").toUpperCase()

        const descriptions: Record<string, string> = {
          "invoice.paid": `Invoice paid (${(amountPaid / 100).toFixed(2)} ${currency})`,
          "invoice.payment_failed": `Invoice payment failed (${(amountDue / 100).toFixed(2)} ${currency})`,
          "invoice.finalized": `Invoice finalised (${(amountDue / 100).toFixed(2)} ${currency})`
        }

        await db.insert(schema.billingActivity).values({
          id: nanoid(),
          subscriptionId: sub.id,
          type: "payment",
          description: descriptions[event.type] || event.type,
          stripeEventId: event.id,
          metadata: {
            stripeEventId: event.id,
            stripeInvoiceId: invoice.id,
            amountDue,
            amountPaid,
            currency: invoice.currency,
            invoiceStatus: invoice.status
          },
          createdAt: new Date()
        }).onConflictDoNothing({
          target: schema.billingActivity.stripeEventId
        })
      }
    }
  }
})
