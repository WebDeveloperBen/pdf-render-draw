/**
 * Feature Flags
 *
 * Shared feature flag definitions used by both server and client.
 * Server resolves flags from environment/config, then exposes via /api/features.
 * Client consumes via useFeatureFlags() composable.
 *
 * To add a new flag:
 * 1. Add it to FeatureFlags interface
 * 2. Add a default in DEFAULT_FEATURES
 * 3. Add env override key in FEATURE_ENV_KEYS
 */

export interface FeatureFlags {
  /** Geometric room detection from PDF path operators */
  roomDetection: boolean
  /** Text + wall smart detection (no AI, client-side) */
  roomSmartDetect: boolean
  /** AI vision-based room detection (costs money, server-side) */
  roomAiDetect: boolean
  /** Raw debug overlay for plan geometry (nodes, edges, segments) */
  roomDebugPlan: boolean
}

/** All flags and their default values */
export const DEFAULT_FEATURES: Readonly<FeatureFlags> = {
  roomDetection: false,
  roomSmartDetect: false,
  roomAiDetect: false,
  roomDebugPlan: true,
}

/**
 * Map of feature flag → environment variable name.
 * Set any of these to "true" or "1" to enable the feature.
 */
export const FEATURE_ENV_KEYS: Readonly<Record<keyof FeatureFlags, string>> = {
  roomDetection: "FEATURE_ROOM_DETECTION",
  roomSmartDetect: "FEATURE_ROOM_SMART_DETECT",
  roomAiDetect: "FEATURE_ROOM_AI_DETECT",
  roomDebugPlan: "FEATURE_ROOM_DEBUG_PLAN",
}

/** Resolve feature flags from environment variables (server-side) */
export function resolveFeatureFlags(env: Record<string, string | undefined>): FeatureFlags {
  const flags = { ...DEFAULT_FEATURES }

  for (const [flag, envKey] of Object.entries(FEATURE_ENV_KEYS) as [keyof FeatureFlags, string][]) {
    const value = env[envKey]
    if (value !== undefined) {
      flags[flag] = value === "true" || value === "1"
    }
  }

  return flags
}
