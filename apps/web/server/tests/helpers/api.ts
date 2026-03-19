import type { AuthHeaders } from "./auth"
import { expectHttpError, testFetch, type TestRequestOptions } from "./http"

/**
 * Make an authenticated API call. Merges auth headers with request options.
 * Returns the parsed response body.
 */
export async function authedFetch<T = unknown>(
  path: string,
  headers: AuthHeaders,
  opts: TestRequestOptions = {}
): Promise<T> {
  return await testFetch<T>(path, {
    ...opts,
    headers: { ...headers, ...(opts.headers ?? {}) }
  })
}

/**
 * Make an API call expecting a specific error status code.
 * Returns the error response data or throws if the status doesn't match.
 */
export async function expectError(
  path: string,
  expectedStatus: number,
  opts: TestRequestOptions = {}
): Promise<{ statusCode: number; statusMessage: string; data?: unknown }> {
  return await expectHttpError(path, expectedStatus, opts)
}
