import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { seedStandardScenario, type SeededData } from "../fixtures/seed"
import { getTestDb } from "../helpers/db"
import { buildUrl, waitForTestServer } from "../helpers/http"

function extractCookieHeader(response: Response): string {
  const setCookie = response.headers.get("set-cookie")
  if (!setCookie) {
    throw new Error("Expected auth response to include Set-Cookie header")
  }

  return setCookie
    .split(/,(?=[^;]+?=)/g)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie))
    .join("; ")
}

async function postAuth(path: string, body?: unknown, cookieHeader?: string) {
  const headers: Record<string, string> = {
    ...(cookieHeader ? { Cookie: cookieHeader } : {})
  }

  if (body !== undefined) {
    headers["content-type"] = "application/json"
  }

  return fetch(buildUrl(path), {
    method: "POST",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  })
}

async function getAuthSession(cookieHeader: string) {
  const response = await fetch(buildUrl("/api/auth/get-session?disableCookieCache=true"), {
    headers: {
      Cookie: cookieHeader
    }
  })

  const data = (await response.json()) as {
    session: { activeOrganizationId?: string | null } | null
    user: { id: string; email: string } | null
  } | null

  return { response, data }
}

describe("Auth HTTP API", () => {
  let seed: SeededData

  beforeEach(async () => {
    await waitForTestServer()
    seed = await seedStandardScenario(getTestDb())
  })

  afterEach(async () => {
    await postAuth("/api/auth/sign-out", {}).catch(() => {})
  })

  it("issues session cookies through the public sign-in endpoint", async () => {
    const response = await postAuth("/api/auth/sign-in/email", {
      email: seed.users.regularUser.email,
      password: seed.password
    })

    const cookieHeader = extractCookieHeader(response)
    const { response: sessionResponse, data } = await getAuthSession(cookieHeader)

    expect(response.ok).toBe(true)
    expect(sessionResponse.ok).toBe(true)
    expect(data?.user).toEqual(
      expect.objectContaining({
        id: seed.users.regularUser.id,
        email: seed.users.regularUser.email
      })
    )
    expect(data?.session).toEqual(
      expect.objectContaining({
        activeOrganizationId: null
      })
    )
  })

  it("switches active organisation through the public organisation auth endpoint", async () => {
    const signInResponse = await postAuth("/api/auth/sign-in/email", {
      email: seed.users.regularUser.email,
      password: seed.password
    })

    const cookieHeader = extractCookieHeader(signInResponse)

    const switchResponse = await postAuth(
      "/api/auth/organization/set-active",
      {
        organizationId: seed.orgs.demo.id
      },
      cookieHeader
    )

    const { data } = await getAuthSession(cookieHeader)

    expect(switchResponse.ok).toBe(true)
    expect(data?.session?.activeOrganizationId).toBe(seed.orgs.demo.id)
  })

  it("invalidates the session through the public sign-out endpoint", async () => {
    const signInResponse = await postAuth("/api/auth/sign-in/email", {
      email: seed.users.regularUser.email,
      password: seed.password
    })

    const cookieHeader = extractCookieHeader(signInResponse)

    const signOutResponse = await postAuth("/api/auth/sign-out", {}, cookieHeader)
    const { response: sessionResponse, data } = await getAuthSession(cookieHeader)

    expect(signOutResponse.status).toBe(200)
    expect(sessionResponse.ok).toBe(true)
    expect(data).toBeNull()
  })
})
