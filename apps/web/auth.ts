import { betterAuth } from "better-auth/minimal"
import { createAuthMiddleware } from "better-auth/api"
import { admin, openAPI, organization, magicLink } from "better-auth/plugins"
import { apiKey } from "@better-auth/api-key"
import { stripe } from "@better-auth/stripe"
import Stripe from "stripe"
import { eq, and } from "drizzle-orm"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nanoid } from "nanoid"
import { db } from "./server/utils/drizzle"
import * as schema from "./shared/db/schema"
import { ac, roles } from "./shared/auth/access-control"
import { platformAdminPlugin } from "./shared/auth/plugins/platform-admin"
import {
  sendPasswordResetEmail,
  sendMagicLinkEmail,
  sendOrganizationInviteEmail,
  sendVerificationEmail
} from "./server/utils/email"

// Stripe client for Better Auth plugin and admin billing service
export const stripeClient = new Stripe(process.env.NUXT_STRIPE_SECRET_KEY || "sk_test_placeholder")

// Helper to log admin actions to audit log
async function logAdminAction(params: {
  adminId: string
  actionType: string
  targetUserId?: string | null
  targetOrgId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}) {
  try {
    await db.insert(schema.adminAuditLog).values({
      id: nanoid(),
      adminId: params.adminId,
      actionType: params.actionType,
      targetUserId: params.targetUserId ?? null,
      targetOrgId: params.targetOrgId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      createdAt: new Date()
    })
  } catch (error) {
    console.error("[Audit Log] Failed to log admin action:", error)
  }
}

export const auth = betterAuth({
  experimental: { joins: true },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // Cache duration in seconds
    }
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const session = ctx.context.session
      if (!session?.user?.id) return

      const adminId = session.user.id
      const ipAddress = ctx.request?.headers.get("x-forwarded-for") || null
      const userAgent = ctx.request?.headers.get("user-agent") || null

      // Ban user
      if (ctx.path === "/admin/ban-user") {
        const body = ctx.body as { userId?: string; banReason?: string; banExpiresIn?: number }
        await logAdminAction({
          adminId,
          actionType: "user_banned",
          targetUserId: body?.userId,
          metadata: { banReason: body?.banReason, banExpiresIn: body?.banExpiresIn },
          ipAddress,
          userAgent
        })
      }

      // Unban user
      if (ctx.path === "/admin/unban-user") {
        const body = ctx.body as { userId?: string }
        await logAdminAction({
          adminId,
          actionType: "user_unbanned",
          targetUserId: body?.userId,
          ipAddress,
          userAgent
        })
      }

      // Impersonate user
      if (ctx.path === "/admin/impersonate-user") {
        const body = ctx.body as { userId?: string }
        await logAdminAction({
          adminId,
          actionType: "impersonation_started",
          targetUserId: body?.userId,
          ipAddress,
          userAgent
        })
      }

      // Stop impersonating
      if (ctx.path === "/admin/stop-impersonating") {
        // The impersonatedBy field tells us who the original admin was
        const impersonatedBy = (session as { impersonatedBy?: string }).impersonatedBy
        await logAdminAction({
          adminId: impersonatedBy || adminId,
          actionType: "impersonation_stopped",
          targetUserId: adminId, // The user being impersonated
          ipAddress,
          userAgent
        })
      }
    })
  },
  plugins: [
    admin({
      ac,
      roles: {
        platform_admin: roles.platform_admin
      },
      defaultRole: "user",
      defaultBanExpiresIn: 7 * 24 * 60 * 60,
      defaultBanReason: "Spamming",
      impersonationSessionDuration: 1 * 24 * 60 * 60
    }),
    apiKey(),
    organization({
      ac,
      roles,
      teams: { enabled: true },
      async sendInvitationEmail({ email, organization, inviter, invitation }) {
        const invitationUrl = `${process.env.NUXT_BETTER_AUTH_URL}/invite/${invitation.id}`
        await sendOrganizationInviteEmail(
          email,
          invitationUrl,
          organization.name,
          inviter.user.name || inviter.user.email
        )
      }
    }),
    stripe({
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
          const plans = await db.query.stripePlan.findMany({
            where: eq(schema.stripePlan.active, true)
          })

          return plans.map((plan) => ({
            name: plan.name.toLowerCase(),
            priceId: plan.stripePriceId,
            annualDiscountPriceId: plan.annualDiscountPriceId ?? undefined,
            lookupKey: plan.lookupKey ?? undefined,
            limits: (plan.limits as Record<string, number>) ?? undefined,
            group: plan.group ?? undefined,
            ...(plan.trialDays ? { freeTrial: { days: plan.trialDays } } : {})
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
        // These are not handled by the plugin natively
        if (
          event.type === "invoice.paid" ||
          event.type === "invoice.payment_failed" ||
          event.type === "invoice.finalized"
        ) {
          const invoice = event.data.object as any
          const subscriptionId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : (invoice.subscription as { id?: string })?.id

          if (subscriptionId) {
            // Find our local subscription by Stripe subscription ID
            const sub = await db.query.subscription.findFirst({
              where: eq(schema.subscription.stripeSubscriptionId, subscriptionId)
            })

            if (sub) {
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
                metadata: {
                  stripeEventId: event.id,
                  stripeInvoiceId: invoice.id,
                  amountDue,
                  amountPaid,
                  currency: invoice.currency,
                  invoiceStatus: invoice.status
                },
                createdAt: new Date()
              })
            }
          }
        }
      }
    }),
    platformAdminPlugin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
      expiresIn: 60 * 60 * 24 * 7 // 7 days for guest links
    }),
    openAPI()
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Check if this user has any pending share invitations
          const pendingRecipient = await db.query.projectShareRecipient.findFirst({
            where: eq(schema.projectShareRecipient.email, user.email),
            with: { share: { with: { project: true } } }
          })

          // Determine if this is a magic link signup vs normal registration
          // Magic link signups don't have firstName/lastName (only email)
          // Normal registration requires firstName/lastName
          const isMagicLinkSignup = !user.firstName && !user.lastName

          if (pendingRecipient && isMagicLinkSignup) {
            // Magic link signup from share invite → create as guest
            await db
              .update(schema.user)
              .set({
                isGuest: true,
                guestOrganizationId: pendingRecipient.share.project.organizationId
              })
              .where(eq(schema.user.id, user.id))

            // Link recipient to user and mark as viewed
            await db
              .update(schema.projectShareRecipient)
              .set({
                userId: user.id,
                status: "viewed",
                firstViewedAt: new Date()
              })
              .where(eq(schema.projectShareRecipient.id, pendingRecipient.id))

            // Skip auto-org creation for guests
            return
          }

          if (pendingRecipient && !isMagicLinkSignup) {
            // Normal registration but user has pending share invitations
            // Link them to the share recipient record (so they can see shared content)
            // but create them as a full user with their own organization
            await db
              .update(schema.projectShareRecipient)
              .set({
                userId: user.id,
                status: "viewed",
                firstViewedAt: new Date()
              })
              .where(eq(schema.projectShareRecipient.id, pendingRecipient.id))
          }

          // Regular user (or normal registration with pending invite) - create home organization
          await auth.api.createOrganization({
            body: {
              name: `${user.firstName}'s Organization`,
              slug: `${user.email.split("@")[0]}-${user.id.slice(0, 8)}`,
              userId: user.id
            }
          })
        }
      }
    }
  },
  trustedOrigins: [
    "http://0.0.0.0:3000",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://pdf-annotator.bens-digital.workers.dev",
    "https://pdf-app-dev.bens.digital"
  ],
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        fieldName: "firstName",
        returned: true,
        input: true,
        required: true
      },
      lastName: {
        type: "string",
        fieldName: "lastName",
        returned: true,
        input: true,
        required: true
      },
      isGuest: {
        type: "boolean",
        fieldName: "isGuest",
        defaultValue: false,
        returned: true,
        input: false // Set by system only
      },
      guestOrganizationId: {
        type: "string",
        fieldName: "guestOrganizationId",
        returned: true,
        input: false,
        required: false
      }
    },
    deleteUser: {
      enabled: true
    }
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      // Append callbackURL so after verification, users land on our verify-email page
      const verificationUrl = new URL(url)
      verificationUrl.searchParams.set("callbackURL", `/verify-email?email=${encodeURIComponent(user.email)}`)
      await sendVerificationEmail(user.email, verificationUrl.toString())
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      await sendPasswordResetEmail(user.email, url)
    }
  },
  socialProviders: {
    // Providers are auto-enabled when their env vars are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        }
      }
      : {}),
  }
})
