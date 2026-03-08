import { DEFAULT_FEATURES, type FeatureFlags } from "@shared/features"

const flags = ref<FeatureFlags>({ ...DEFAULT_FEATURES })
const fetched = ref(false)

/**
 * Feature flags composable.
 *
 * Fetches flags from /api/features on first use, then caches in memory.
 * All consumers share the same reactive state.
 */
export function useFeatureFlags() {
  if (!fetched.value) {
    fetched.value = true
    $fetch<FeatureFlags>("/api/features")
      .then((data) => { flags.value = data })
      .catch((err) => { console.error("[FeatureFlags] Failed to fetch:", err) })
  }

  return {
    flags: readonly(flags),

    /** Check a single flag */
    isEnabled: (flag: keyof FeatureFlags) => flags.value[flag],

    /** Force re-fetch (e.g. after admin toggle) */
    async refresh() {
      try {
        flags.value = await $fetch<FeatureFlags>("/api/features")
      } catch (err) {
        console.error("[FeatureFlags] Failed to refresh:", err)
      }
    }
  }
}
