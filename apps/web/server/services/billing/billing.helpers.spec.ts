import { describe, it, expect } from "vitest"
import { parseLimitsFromMetadata, parseFeaturesFromMetadata } from "./billing.helpers"

describe("parseLimitsFromMetadata", () => {
  it("parses numeric limits from metadata", () => {
    const result = parseLimitsFromMetadata({
      limit_projects: "5",
      limit_storage_mb: "100",
      limit_file_size_mb: "25"
    })

    expect(result).toEqual({
      projects: 5,
      storageMb: 100,
      fileSizeMb: 25
    })
  })

  it('treats "unlimited" as -1', () => {
    const result = parseLimitsFromMetadata({
      limit_projects: "unlimited",
      limit_storage_mb: "unlimited",
      limit_file_size_mb: "50"
    })

    expect(result).toEqual({
      projects: -1,
      storageMb: -1,
      fileSizeMb: 50
    })
  })

  it("treats missing keys as -1 (unlimited)", () => {
    const result = parseLimitsFromMetadata({})

    expect(result).toEqual({
      projects: -1,
      storageMb: -1,
      fileSizeMb: -1
    })
  })

  it("treats non-numeric values as -1", () => {
    const result = parseLimitsFromMetadata({
      limit_projects: "abc",
      limit_storage_mb: "",
      limit_file_size_mb: "NaN"
    })

    expect(result).toEqual({
      projects: -1,
      storageMb: -1,
      fileSizeMb: -1
    })
  })

  it("includes includedSeats when limit_included_seats is present", () => {
    const result = parseLimitsFromMetadata({
      limit_projects: "unlimited",
      limit_storage_mb: "1000",
      limit_file_size_mb: "50",
      limit_included_seats: "3"
    })

    expect(result).toEqual({
      projects: -1,
      storageMb: 1000,
      fileSizeMb: 50,
      includedSeats: 3
    })
  })

  it("does not include includedSeats when key is absent", () => {
    const result = parseLimitsFromMetadata({
      limit_projects: "5",
      limit_storage_mb: "100",
      limit_file_size_mb: "25"
    })

    expect(result).not.toHaveProperty("includedSeats")
  })
})

describe("parseFeaturesFromMetadata", () => {
  it("parses a full professional plan metadata", () => {
    const result = parseFeaturesFromMetadata({
      feature_export_formats: "pdf,png,svg",
      feature_measurement_tools: "all",
      feature_cloud_sync: "true",
      feature_collaboration: "false",
      feature_custom_branding: "false",
      feature_measurement_presets: "true"
    })

    expect(result).toEqual({
      exportFormats: ["pdf", "png", "svg"],
      measurementTools: "all",
      cloudSync: true,
      collaboration: false,
      customBranding: false,
      measurementPresets: true
    })
  })

  it("returns free tier defaults for empty metadata", () => {
    const result = parseFeaturesFromMetadata({})

    expect(result).toEqual({
      exportFormats: ["pdf"],
      measurementTools: "basic",
      cloudSync: false,
      collaboration: false,
      customBranding: false,
      measurementPresets: false
    })
  })

  it("parses team plan with all features enabled", () => {
    const result = parseFeaturesFromMetadata({
      feature_export_formats: "pdf,png,svg",
      feature_measurement_tools: "all",
      feature_cloud_sync: "true",
      feature_collaboration: "true",
      feature_custom_branding: "true",
      feature_measurement_presets: "true"
    })

    expect(result.collaboration).toBe(true)
    expect(result.customBranding).toBe(true)
    expect(result.cloudSync).toBe(true)
  })

  it("includes optional sla and dedicatedSupport when present", () => {
    const result = parseFeaturesFromMetadata({
      feature_export_formats: "pdf,png,svg",
      feature_measurement_tools: "all",
      feature_cloud_sync: "true",
      feature_collaboration: "true",
      feature_custom_branding: "true",
      feature_measurement_presets: "true",
      feature_sla: "true",
      feature_dedicated_support: "true"
    })

    expect(result.sla).toBe(true)
    expect(result.dedicatedSupport).toBe(true)
  })

  it("excludes optional sla and dedicatedSupport when absent", () => {
    const result = parseFeaturesFromMetadata({
      feature_export_formats: "pdf",
      feature_measurement_tools: "basic"
    })

    expect(result).not.toHaveProperty("sla")
    expect(result).not.toHaveProperty("dedicatedSupport")
  })

  it("treats feature_cloud_sync !== 'true' as false", () => {
    const result = parseFeaturesFromMetadata({
      feature_cloud_sync: "false"
    })
    expect(result.cloudSync).toBe(false)

    const result2 = parseFeaturesFromMetadata({
      feature_cloud_sync: "yes"
    })
    expect(result2.cloudSync).toBe(false)
  })

  it("handles single export format", () => {
    const result = parseFeaturesFromMetadata({
      feature_export_formats: "pdf"
    })
    expect(result.exportFormats).toEqual(["pdf"])
  })
})
