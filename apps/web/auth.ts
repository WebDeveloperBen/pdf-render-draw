import { betterAuth } from "better-auth/minimal"
import { admin, openAPI, organization, magicLink } from "better-auth/plugins"
import { apiKey } from "@better-auth/api-key"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { eq } from "drizzle-orm"
import { db } from "./server/utils/drizzle"
import * as schema from "./shared/db/schema"
import { ac, roles } from "./shared/auth/access-control"
import { platformAdminPlugin } from "./shared/auth/plugins/platform-admin"
import { useEvent } from "nitropack/runtime"
import { sendMagicLinkEmail, sendOrganizationInviteEmail } from "./server/utils/email"
import {
  createAuditHook,
  stripeClient,
  stripePlugin,
  emailVerificationConfig,
  emailAndPasswordConfig,
  socialProviders
} from "./auth/index"

export { stripeClient }

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
    backgroundTasks: {
      handler: (promise) => {
        // Use Cloudflare's waitUntil to defer non-critical work (email sending,
        // rate limit updates, session cleanup) after the response is sent.
        // Falls back to fire-and-forget if called outside a request context.
        try {
          const event = useEvent()
          event.context.cloudflare?.context?.waitUntil(promise)
        } catch {
          promise.catch(() => { })
        }
      }
    }
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
    openAPI()
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
