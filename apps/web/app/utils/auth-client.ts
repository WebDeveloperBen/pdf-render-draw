import {
  inferAdditionalFields,
  adminClient,
  organizationClient,
  apiKeyClient,
  magicLinkClient
} from "better-auth/client/plugins"
import { stripeClient } from "@better-auth/stripe/client"
import { createAuthClient } from "better-auth/vue"
import type { auth } from "@auth"
import { ac, roles } from "@shared/auth/access-control"
import { platformAdminClient } from "@shared/auth/plugins/platform-admin.client"

export const authClient = createAuthClient({
  // No baseURL needed - use useFetch for SSR support (e.g., authClient.useSession(useFetch))
  plugins: [
    inferAdditionalFields<typeof auth>(),
    adminClient(),
    organizationClient({ ac, roles }),
    apiKeyClient(),
    platformAdminClient(),
    magicLinkClient(),
    stripeClient({ subscription: true })
  ]
})

// Auth methods
export const { signIn, signOut, signUp, useSession, requestPasswordReset, resetPassword, deleteUser } = authClient

// Organization client - renamed to avoid conflict with database table
// Use authClient.organization directly in components for full access to all methods
export const orgClient = authClient.organization

// Admin client - for better-auth admin plugin (ban, impersonate, etc.)
export const adminClient$ = authClient.admin

// Platform Admin client - for tiered platform admin management
export const platformAdmin$ = authClient.platformAdmin

// Stripe subscription client - for customer-facing billing flows
export const subscriptionClient$ = authClient.subscription
