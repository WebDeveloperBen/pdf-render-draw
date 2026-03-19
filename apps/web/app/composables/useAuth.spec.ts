import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import { ref } from "vue"

const mockState = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  navigateTo: vi.fn(),
  route: {
    query: {} as Record<string, string | undefined>
  }
}))

mockNuxtImport("navigateTo", () => mockState.navigateTo)
mockNuxtImport("useRoute", () => () => mockState.route)

vi.mock("~/utils/auth-client", () => ({
  authClient: {
    getSession: (...args: unknown[]) => mockState.getSession(...args),
    signOut: (...args: unknown[]) => mockState.signOut(...args),
    useSession: (...args: unknown[]) => (args.length > 0 ? { data: ref(null) } : ref(null))
  }
}))

import { useAuth } from "./useAuth"

describe("useAuth", () => {
  beforeEach(() => {
    mockState.route.query = {}
    mockState.getSession.mockReset()
    mockState.signOut.mockReset()
    mockState.navigateTo.mockReset()
  })

  it("redirects guests to the guest area after auth", async () => {
    mockState.getSession.mockResolvedValue({
      data: {
        user: {
          isGuest: true
        }
      }
    })

    const { redirectAfterAuth } = useAuth()
    await redirectAfterAuth()

    expect(mockState.navigateTo).toHaveBeenCalledWith("/g")
  })

  it("uses a safe relative redirect when provided", async () => {
    mockState.route.query.redirect = "/projects"
    mockState.getSession.mockResolvedValue({
      data: {
        user: {
          isGuest: false
        }
      }
    })

    const { redirectAfterAuth } = useAuth()
    await redirectAfterAuth("/dashboard")

    expect(mockState.navigateTo).toHaveBeenCalledWith("/projects")
  })

  it("falls back to the default path for unsafe redirects", async () => {
    mockState.route.query.redirect = "https://evil.example.com/phish"
    mockState.getSession.mockResolvedValue({
      data: {
        user: {
          isGuest: false
        }
      }
    })

    const { redirectAfterAuth } = useAuth()
    await redirectAfterAuth("/dashboard")

    expect(mockState.navigateTo).toHaveBeenCalledWith("/dashboard")
  })

  it("signs out and forces a full-page redirect to login", async () => {
    mockState.signOut.mockResolvedValue(undefined)

    const { signOut } = useAuth()
    await signOut()

    expect(mockState.signOut).toHaveBeenCalled()
    expect(mockState.navigateTo).toHaveBeenCalledWith("/login", { external: true })
  })
})
