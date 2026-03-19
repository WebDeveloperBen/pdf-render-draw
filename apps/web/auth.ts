import { betterAuth } from "better-auth/minimal"
import { admin, openAPI, organization, magicLink, testUtils } from "better-auth/plugins"
import { APIError } from "better-auth/api"
import { apiKey } from "@better-auth/api-key"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { and, count, eq, inArray } from "drizzle-orm"
import { db } from "./server/utils/drizzle"
import * as schema from "./shared/db/schema"
import { ac, roles } from "./shared/auth/access-control"
import { getOrganizationMemberLimit } from "./shared/utils/billing-seats"
import { platformAdminPlugin } from "./shared/auth/plugins/platform-admin"
import { sendMagicLinkEmail, sendOrganizationInviteEmail } from "./server/services/email/email.service"
import {
  backgroundTasksConfig,
  createAuditHook,
  stripeClient,
  stripePlugin,
  emailVerificationConfig,
  emailAndPasswordConfig,
  socialProviders
} from "./auth/index"

export { stripeClient }

const ACTIVE_ORGANIZATION_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const

async function getActiveOrganizationSubscription(organizationId: string) {
  return db.query.subscription.findFirst({
    where: and(
      eq(schema.subscription.referenceId, organizationId),
      inArray(schema.subscription.status, ACTIVE_ORGANIZATION_SUBSCRIPTION_STATUSES)
    )
  })
}

async function getOrganizationSeatLimit(organizationId: string) {
  const subscription = await getActiveOrganizationSubscription(organizationId)
  return getOrganizationMemberLimit(subscription?.plan, subscription?.seats)
}

async function countOrganizationMembers(organizationId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(schema.member)
    .where(eq(schema.member.organizationId, organizationId))

  return result?.count ?? 0
}

async function countPendingOrganizationInvitations(organizationId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(schema.invitation)
    .where(and(eq(schema.invitation.organizationId, organizationId), eq(schema.invitation.status, "pending")))

  return result?.count ?? 0
}

async function assertOrganizationHasSeatCapacity(organizationId: string, additionalReservedSeats = 0) {
  const [seatLimit, memberCount, pendingInvitationCount] = await Promise.all([
    getOrganizationSeatLimit(organizationId),
    countOrganizationMembers(organizationId),
    countPendingOrganizationInvitations(organizationId)
  ])

  const reservedSeats = memberCount + pendingInvitationCount + additionalReservedSeats

  if (reservedSeats <= seatLimit) {
    return
  }

  const message =
    seatLimit <= 1
      ? "Your current plan only allows one organisation member. Upgrade to Team before inviting more people."
      : `This organisation has used all ${seatLimit} billed seats. Increase your seat count before inviting or adding another member.`

  throw new APIError("FORBIDDEN", { message })
}

export const auth = betterAuth({
  telemetry: { enabled: false },
  experimental: { joins: true },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  },
  advanced: {
    backgroundTasks: backgroundTasksConfig
  },
  hooks: {
    after: createAuditHook()
  },
  plugins: [
    admin({
      ac,
      roles: { platform_admin: roles.platform_admin },
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
      membershipLimit: async (_user, organization) => getOrganizationSeatLimit(organization.id),
      organizationHooks: {
        beforeCreateInvitation: async ({ organization }) => {
          await assertOrganizationHasSeatCapacity(organization.id, 1)
        },
        beforeAcceptInvitation: async ({ organization }) => {
          await assertOrganizationHasSeatCapacity(organization.id)
        },
        beforeAddMember: async ({ organization }) => {
          await assertOrganizationHasSeatCapacity(organization.id, 1)
        }
      },
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
    stripePlugin,
    platformAdminPlugin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
      expiresIn: 60 * 60 * 24 * 7
    }),
    openAPI(),
    ...(process.env.VITEST ? [testUtils()] : [])
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema
  }),
  // Kept inline — self-references `auth` which creates circular dep if extracted
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const pendingRecipient = await db.query.projectShareRecipient.findFirst({
            where: eq(schema.projectShareRecipient.email, user.email),
            with: { share: { with: { project: true } } }
          })

          const isMagicLinkSignup = !user.firstName && !user.lastName

          if (pendingRecipient && isMagicLinkSignup) {
            await db
              .update(schema.user)
              .set({
                isGuest: true,
                guestOrganizationId: pendingRecipient.share.project.organizationId
              })
              .where(eq(schema.user.id, user.id))

            await db
              .update(schema.projectShareRecipient)
              .set({ userId: user.id, status: "viewed", firstViewedAt: new Date() })
              .where(eq(schema.projectShareRecipient.id, pendingRecipient.id))

            return
          }

          if (pendingRecipient && !isMagicLinkSignup) {
            await db
              .update(schema.projectShareRecipient)
              .set({ userId: user.id, status: "viewed", firstViewedAt: new Date() })
              .where(eq(schema.projectShareRecipient.id, pendingRecipient.id))
          }

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
        input: false
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
  emailVerification: emailVerificationConfig,
  emailAndPassword: emailAndPasswordConfig,
  socialProviders
})
