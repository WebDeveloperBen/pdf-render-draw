import { $fetch } from "@nuxt/test-utils/e2e"
import type { AuthHeaders } from "./auth"

/**
 * Make an authenticated API call. Merges auth headers with request options.
 * Returns the parsed response body.
 */
export async function authedFetch<T = unknown>(
  path: string,
  headers: AuthHeaders,
  opts: Record<string, unknown> = {}
): Promise<T> {
  return $fetch<T>(path, {
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string>) }
  })
}

/**
 * Make an API call expecting a specific error status code.
 * Returns the error response data or throws if the status doesn't match.
 */
export async function expectError(
  path: string,
  expectedStatus: number,
  opts: Record<string, unknown> = {}
): Promise<{ statusCode: number; statusMessage: string; data?: unknown }> {
  try {
    await $fetch(path, opts)
    throw new Error(`Expected ${expectedStatus} error but request succeeded`)
  } catch (error: unknown) {
    const fetchError = error as { status?: number; statusCode?: number; data?: unknown; statusMessage?: string }
    const status = fetchError.status ?? fetchError.statusCode
    if (status !== expectedStatus) {
      throw new Error(`Expected ${expectedStatus} but got ${status}: ${JSON.stringify(fetchError.data)}`)
    }
    return {
      statusCode: expectedStatus,
      statusMessage: fetchError.statusMessage ?? "",
      data: fetchError.data
    }
  }
}
