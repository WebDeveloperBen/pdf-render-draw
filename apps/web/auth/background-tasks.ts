import { useEvent } from "nitropack/runtime"

/**
 * Cloudflare waitUntil background task handler for better-auth.
 *
 * Defers non-critical work (email sending, rate limit updates, session cleanup)
 * until after the response is sent. Falls back to fire-and-forget if called
 * outside a request context.
 */
export const backgroundTasksConfig = {
  handler: (promise: Promise<unknown>) => {
    try {
      const event = useEvent()
      event.context.cloudflare?.context?.waitUntil(promise)
    } catch {
      promise.catch(() => {})
    }
  }
}
