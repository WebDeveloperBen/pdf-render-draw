import { inferAdditionalFields, adminClient, organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/vue"
import type { auth } from "../../auth"

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    adminClient(),
    organizationClient()
  ]
})

export const { signIn, signOut, signUp, useSession, requestPasswordReset, resetPassword, deleteUser } = authClient
