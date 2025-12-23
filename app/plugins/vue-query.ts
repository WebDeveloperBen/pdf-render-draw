import type { DehydratedState, VueQueryPluginOptions } from "@tanstack/vue-query"
import { VueQueryPlugin, QueryClient, hydrate, dehydrate } from "@tanstack/vue-query"
import { defineNuxtPlugin, useState } from "#imports"

export default defineNuxtPlugin((nuxt) => {
  const vueQueryState = useState<DehydratedState | null>("vue-query")

  // Track refresh state to prevent multiple simultaneous refreshes
  // const isRefreshing = false

  // Handle 401 errors by attempting token refresh, then re-auth if needed
  // TODO: reimplement this when needed if needed
  // const handle401Error = async (queryClient: QueryClient) => {
  //   if (!import.meta.client || isRefreshing) return
  //
  //   isRefreshing = true
  //
  //   try {
  //     const { $authClient } = useNuxtApp()
  //
  //     // First try to refresh using the existing refresh token
  //     try {
  //       await $authClient.refreshBackendTokens()
  //       // Success - invalidate all queries to trigger refetch with new tokens
  //       await queryClient.invalidateQueries()
  //       return
  //     } catch (refreshError) {
  //       console.warn("Token refresh failed, trying Entra exchange:", refreshError)
  //     }
  //
  //     // Refresh failed - try to get fresh tokens from Entra ID
  //     await $authClient.exchangeForBackendTokens()
  //
  //     // Success - invalidate all queries to trigger refetch with new tokens
  //     await queryClient.invalidateQueries()
  //   } catch (exchangeError) {
  //     console.warn("Token exchange also failed after 401:", exchangeError)
  //     // Clear tokens and redirect to login
  //     const { $authClient } = useNuxtApp()
  //     $authClient.clearBackendTokens()
  //     await navigateTo("/login")
  //   } finally {
  //     isRefreshing = false
  //   }
  // }

  // Retry function - synchronous, doesn't retry 401/403
   
  const retryFunction = (failureCount: number, error: any): boolean => {
    // Don't retry auth errors - they're handled by onError
    if (error?.status === 401 || error?.status === 403) {
      return false
    }
    // Retry other errors up to 2 times
    return failureCount < 2
  }

  // Modify your Vue Query global settings here
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5000,
        retry: retryFunction,
        // Refetch on window focus helps after token refresh
        refetchOnWindowFocus: true
      },
      mutations: {
        retry: retryFunction,
        // Handle 401 errors globally for mutations
         
        onError: async (error: any) => {
          if (error?.status === 401) {
            console.error("[Authentication Error]: Please investigate", error)
            // await handle401Error(queryClient)
          }
        }
      }
    }
  })

  // Add global error handler for queries
   
  queryClient.getQueryCache().config.onError = (error: any) => {
    if (error?.status === 401) {
      // handle401Error(queryClient)

      console.error("[Authentication Error]: Unhandled Please investigate", error)
    }
  }

  const options: VueQueryPluginOptions = { queryClient }

  nuxt.vueApp.use(VueQueryPlugin, options)

  if (import.meta.server) {
    nuxt.hooks.hook("app:rendered", () => {
      vueQueryState.value = dehydrate(queryClient)
    })
  }

  if (import.meta.client) {
    hydrate(queryClient, vueQueryState.value)
  }
})
