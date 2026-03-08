import { resolveFeatureFlags, type FeatureFlags } from "@shared/features"

let cached: FeatureFlags | null = null

/** Get resolved feature flags (cached for process lifetime) */
export function getFeatureFlags(): FeatureFlags {
  if (!cached) {
    cached = resolveFeatureFlags(process.env as Record<string, string | undefined>)
  }
  return cached
}

/** Throw 404 if the given feature flag is not enabled */
export function requireFeature(flag: keyof FeatureFlags): void {
  if (!getFeatureFlags()[flag]) {
    throw createError({ statusCode: 404, statusMessage: "Not found" })
  }
}
