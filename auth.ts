import { betterAuth } from "better-auth/minimal"
import { createAuthMiddleware } from "better-auth/api"
import { admin, openAPI, apiKey, organization, magicLink } from "better-auth/plugins"
import { eq } from "drizzle-orm"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nanoid } from "nanoid"
import { db } from "./server/utils/drizzle"
import * as schema from "./shared/db/schema"
import { ac, roles } from "./shared/auth/access-control"
import { platformAdminPlugin } from "./shared/auth/plugins/platform-admin"

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
        // TODO: Integrate with Resend for production
        const invitationUrl = `${process.env.BETTER_AUTH_URL}/invite/${invitation.id}`
        console.log(`[Organization Invite] Sending invitation email:`)
        console.log(`  To: ${email}`)
        console.log(`  Organization: ${organization.name}`)
        console.log(`  Invited by: ${inviter.user.name} (${inviter.user.email})`)
        console.log(`  Invitation URL: ${invitationUrl}`)
      }
    }),
    platformAdminPlugin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Console log for now - Resend integration later
        console.log(`[Magic Link] Sending to ${email}`)
        console.log(`  URL: ${url}`)
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
  trustedOrigins: ["http://0.0.0.0:3000"],
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
    // async sendVerificationEmail({ user, url }) {
    //   await sendUserVerificationEmail(user, url)
    // },
    // sendOnSignUp: true
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    async sendResetPassword(url) {
      console.log("Reset password url:", url)
    }
  },
  socialProviders: {
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID as string,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    // }
  }
})
