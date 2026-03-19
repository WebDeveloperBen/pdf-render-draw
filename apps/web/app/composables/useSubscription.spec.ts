import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import { computed } from "vue"

const mockState = vi.hoisted(() => ({
  profile: null as Record<string, any> | null,
  suspense: vi.fn(),
  refetch: vi.fn()
}))

mockNuxtImport("useGetApiUserProfile", () => {
  return () => ({
    data: computed(() => mockState.profile),
    suspense: mockState.suspense,
    refetch: mockState.refetch
  })
})

import { useSubscription } from "./useSubscription"

describe("useSubscription", () => {
  beforeEach(() => {
    mockState.profile = null
    mockState.suspense.mockReset()
    mockState.refetch.mockReset()
  })

  it("falls back to the free tier when the profile is missing", () => {
    const subscription = useSubscription()

    expect(subscription.planName.value).toBe("free")
    expect(subscription.isFreeTier.value).toBe(true)
    expect(subscription.isPaid.value).toBe(false)
    expect(subscription.hasReachedProjectLimit(1)).toBe(true)
  })

  it("derives paid-plan state, feature gating, and limit checks from the profile payload", () => {
    mockState.profile = {
      data: {
        subscription: {
          status: "trialing",
          cancelAtPeriodEnd: true,
          trialEnd: "2026-05-01T00:00:00.000Z"
        },
        billing: {
          plan: "professional",
          limits: {
            projects: 25,
            storageMb: 2000,
            fileSizeMb: 100
          },
          features: {
            cloudSync: true,
            measurementTools: "advanced",
            exportFormats: ["pdf", "png"]
          }
        },
      }
    }

    const subscription = useSubscription()

    expect(subscription.planName.value).toBe("professional")
    expect(subscription.isProfessional.value).toBe(true)
    expect(subscription.isPaid.value).toBe(true)
    expect(subscription.isTrialing.value).toBe(true)
    expect(subscription.isCanceling.value).toBe(true)
    expect(subscription.canUseFeature("cloudSync" as any)).toBe(true)
    expect(subscription.canUseFeature("measurementTools" as any)).toBe(true)
    expect(subscription.hasReachedProjectLimit(24)).toBe(false)
    expect(subscription.hasReachedProjectLimit(25)).toBe(true)
    expect(subscription.trialEnd.value?.toISOString()).toBe("2026-05-01T00:00:00.000Z")
  })
})
