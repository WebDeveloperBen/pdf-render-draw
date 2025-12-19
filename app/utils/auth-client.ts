import { inferAdditionalFields, adminClient, organizationClient, apiKeyClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/vue"
import type { auth } from "../../auth"

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient(), organizationClient(), apiKeyClient()]
})

// Auth methods
export const { signIn, signOut, signUp, useSession, requestPasswordReset, resetPassword, deleteUser } = authClient

// Organization client - renamed to avoid conflict with database table
// Use authClient.organization directly in components for full access to all methods
export const orgClient = authClient.organization

// Admin client - for super admin panel
export const adminClient$ = authClient.admin
