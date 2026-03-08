import { resolveFeatureFlags } from "@shared/features"

export default defineEventHandler(() => {
  return resolveFeatureFlags(process.env as Record<string, string | undefined>)
})
