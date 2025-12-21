import type { BetterAuthClientPlugin } from "better-auth"
import type { Ref } from "vue"
import type { PlatformAdminTier } from "./platform-admin"

// Re-export the tier type for client-side use
export type { PlatformAdminTier } from "./platform-admin"

/**
 * Platform Admin Client Plugin for better-auth
 * Provides typed client-side access to platform admin APIs
 */

export interface PlatformAdminStatus {
  isPlatformAdmin: boolean
  tier: PlatformAdminTier | null
  grantedAt?: Date
  notes?: string
}

// Type for useFetch-style return
export interface UseFetchReturn<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isPending: false
}

export interface PlatformAdminUser {
  id: string
  name: string
  email: string
  image?: string
}

export interface PlatformAdminListItem {
  id: string
  tier: PlatformAdminTier
  grantedAt: Date
  notes?: string
  user: PlatformAdminUser | null
  grantedBy: Omit<PlatformAdminUser, "image"> | null
}

export interface AuditLogEntry {
  id: string
  actionType: string
  createdAt: Date
  ipAddress?: string
  metadata?: Record<string, unknown>
  admin: Omit<PlatformAdminUser, "image"> | null
  targetUser: Omit<PlatformAdminUser, "image"> | null
}

export const platformAdminClient = () => {
  return {
    id: "platform-admin",
    $InferServerPlugin: {} as ReturnType<typeof import("./platform-admin").platformAdminPlugin>,

    getActions: ($fetch) => ({
      platformAdmin: {
        /**
         * Get the current user's platform admin status
         * @param fetchFn - Optional Nuxt useFetch for SSR support (same pattern as useSession)
         */
        getStatus: async <F extends ((...args: any[]) => any) | undefined = undefined>(
          fetchFn?: F
        ): Promise<
          F extends undefined
            ? Awaited<ReturnType<typeof $fetch<PlatformAdminStatus>>>
            : UseFetchReturn<PlatformAdminStatus>
        > => {
          if (fetchFn) {
            // Use provided fetch (e.g., useFetch for SSR) - same pattern as useSession
            const result = (await fetchFn("/api/auth/platform-admin/me")) as {
              data: Ref<PlatformAdminStatus | null>
              error: Ref<Error | null>
            }
            return {
              data: result.data,
              error: result.error,
              isPending: false
            } as any
          }
          return $fetch<PlatformAdminStatus>("/platform-admin/me", {
            method: "GET"
          }) as any
        },

        /**
         * List all platform admins (requires viewer+ tier)
         */
        list: async () => {
          return await $fetch<{ admins: PlatformAdminListItem[] }>("/platform-admin/list", {
            method: "GET"
          })
        },

        /**
         * Grant platform admin access to a user (requires owner tier)
         */
        grant: async (data: { userId: string; tier: Exclude<PlatformAdminTier, "owner">; notes?: string }) => {
          return await $fetch<{
            success: boolean
            admin: { id: string; userId: string; tier: PlatformAdminTier; grantedAt: Date }
          }>("/platform-admin/grant", {
            method: "POST",
            body: data
          })
        },

        /**
         * Update a platform admin's tier (requires owner tier)
         */
        updateTier: async (data: { userId: string; tier: Exclude<PlatformAdminTier, "owner"> }) => {
          return await $fetch<{ success: boolean; tier: PlatformAdminTier }>("/platform-admin/update-tier", {
            method: "POST",
            body: data
          })
        },

        /**
         * Revoke platform admin access (requires owner tier)
         */
        revoke: async (data: { userId: string }) => {
          return await $fetch<{ success: boolean }>("/platform-admin/revoke", {
            method: "POST",
            body: data
          })
        },

        /**
         * Get audit log entries (requires viewer+ tier)
         */
        getAuditLog: async (params?: { limit?: number; offset?: number }) => {
          const searchParams = new URLSearchParams()
          if (params?.limit) searchParams.set("limit", String(params.limit))
          if (params?.offset) searchParams.set("offset", String(params.offset))

          const query = searchParams.toString()
          return await $fetch<{ logs: AuditLogEntry[] }>(`/platform-admin/audit-log${query ? `?${query}` : ""}`, {
            method: "GET"
          })
        }
      }
    })
  } satisfies BetterAuthClientPlugin
}
