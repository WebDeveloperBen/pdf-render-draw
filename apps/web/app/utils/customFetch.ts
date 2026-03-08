/**
 * Custom Fetch Client for Orval
 *
 * This module provides a custom fetch implementation used by orval-generated API functions.
 * It wraps the native fetch API to provide:
 *
 * 1. **Error throwing on non-2xx responses** - Native fetch doesn't throw on HTTP errors,
 *    but vue-query needs errors to be thrown to trigger its error handling (retry, onError, etc.)
 *
 * 2. **Structured error objects** - ApiError includes status code and parsed response data
 *    for better error handling in components and the global 401 handler.
 *
 * 3. **Consistent response format** - Returns { data, status, headers } matching orval's
 *    expected response structure.
 *
 * Configuration:
 * - Configured in orval.config.ts via the `override.mutator` option
 * - Orval generates API functions that call this instead of native fetch
 *
 * @see orval.config.ts - Mutator configuration
 * @see plugins/vue-query.ts - Global 401 error handling
 * @see composables/useApiClient.ts - Authentication header injection
 */

/**
 * Custom error class for API errors.
 * Thrown when the server returns a non-2xx status code.
 */
export class ApiError extends Error {
  /** HTTP status code (e.g., 401, 404, 500) */
  status: number
  /** Alias for status - for compatibility with different error checking patterns */
  statusCode: number
  /** Parsed response body data */
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.statusCode = status
    this.data = data
  }
}

/**
 * Custom fetch function for orval-generated API calls.
 *
 * @param url - The request URL
 * @param options - Standard RequestInit options (method, headers, body, etc.)
 * @returns Promise resolving to { data, status, headers }
 * @throws ApiError for non-2xx responses
 *
 * @example
 * // This is called automatically by orval-generated functions:
 * // listApplications() -> customFetch('/api/v1/applications', { method: 'GET', headers: {...} })
 */
export const customFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, options)

  // Handle empty responses (204 No Content, etc.)
  const body = [204, 205, 304].includes(response.status) ? null : await response.text()
  const data = body ? JSON.parse(body) : {}

  // Throw on non-2xx so vue-query error handling triggers
  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed with status ${response.status}`
    throw new ApiError(response.status, message, data)
  }

  return { data, status: response.status, headers: response.headers } as T
}
