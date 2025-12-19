import { betterAuth } from "better-auth"
import { admin, openAPI, apiKey, organization } from "better-auth/plugins"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "./server/utils/drizzle"

export const auth = betterAuth({
  plugins: [
    admin({
      defaultRole: "user",
      defaultBanExpiresIn: 7 * 24 * 60 * 60,
      defaultBanReason: "Spamming",
      impersonationSessionDuration: 1 * 24 * 60 * 60
    }),
    apiKey(),
    organization({
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
    openAPI()
  ],
  database: drizzleAdapter(db, {
    provider: "pg"
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-create home organization for new users
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
