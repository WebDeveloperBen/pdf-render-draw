import type { TestCookie, TestHelpers } from "better-auth/plugins"
import { buildUrl, waitForTestServer } from "./http"

export type AuthHeaders = Record<string, string>

interface AuthTestContext {
  auth: typeof import("@auth").auth
  test: TestHelpers
}

function toAuthHeaders(cookies: TestCookie[]): AuthHeaders {
  return {
    Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
  }
}

/**
 * Lazily resolved Better Auth test helpers.
 * We import `auth` dynamically because it depends on Nuxt runtime context
 * which is only available after the test server boots.
 */
async function getTestContext(): Promise<AuthTestContext> {
  await waitForTestServer()

  const baseUrl = buildUrl("/").toString().replace(/\/$/, "")
  process.env.BETTER_AUTH_URL = baseUrl
  process.env.NUXT_PUBLIC_BETTER_AUTH_URL = baseUrl

  const { auth } = await import("@auth")
  const ctx = await auth.$context
  const test = (ctx as Record<string, unknown>).test as TestHelpers | undefined
  if (!test) {
    throw new Error(
      "Better Auth test-utils plugin not available. Ensure testUtils() is in auth.ts plugins and VITEST env is set."
    )
  }
  return { auth, test }
}

/**
 * Create an authenticated session via Better Auth's test-utils plugin.
 * Returns cookie headers for use with $fetch.
 */
export async function getAuthHeaders(userId: string): Promise<AuthHeaders> {
  const { test } = await getTestContext()
  const result = await test.login({ userId })
  return toAuthHeaders(result.cookies)
}

/**
 * Create an authenticated session with an active org.
 * Uses Better Auth's real setActiveOrganization flow so tests keep
 * the same membership and authorisation invariants as production.
 */
export async function createAuthenticatedUser(userId: string, orgId: string): Promise<AuthHeaders> {
  const { auth, test } = await getTestContext()
  const result = await test.login({ userId })

  await auth.api.setActiveOrganization({
    body: { organizationId: orgId },
    headers: result.headers
  })

  return toAuthHeaders(result.cookies)
}
