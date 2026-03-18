import type { PlanLimits, PlanFeatures } from "@shared/types/billing"

export function parseLimitsFromMetadata(metadata: Record<string, string>): PlanLimits {
  const parseNum = (val: string | undefined): number => {
    if (!val || val === "unlimited") return -1
    const n = parseInt(val, 10)
    return isNaN(n) ? -1 : n
  }

  return {
    projects: parseNum(metadata.limit_projects),
    storageMb: parseNum(metadata.limit_storage_mb),
    fileSizeMb: parseNum(metadata.limit_file_size_mb),
    ...(metadata.limit_included_seats ? { includedSeats: parseInt(metadata.limit_included_seats, 10) } : {})
  }
}

export function parseFeaturesFromMetadata(metadata: Record<string, string>): PlanFeatures {
  return {
    exportFormats: (metadata.feature_export_formats ?? "pdf").split(","),
    measurementTools: (metadata.feature_measurement_tools as "basic" | "all") ?? "basic",
    cloudSync: metadata.feature_cloud_sync === "true",
    collaboration: metadata.feature_collaboration === "true",
    customBranding: metadata.feature_custom_branding === "true",
    measurementPresets: metadata.feature_measurement_presets === "true",
    ...(metadata.feature_sla === "true" ? { sla: true } : {}),
    ...(metadata.feature_dedicated_support === "true" ? { dedicatedSupport: true } : {})
  }
}
