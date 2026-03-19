interface AppBrandingConfig {
  name?: string
  brandColor?: string
  footerText?: string
}

interface RuntimeConfigWithAppBranding {
  databaseUrl?: string
  resendApiKey?: string
  emailFrom?: string
  public?: {
    app?: AppBrandingConfig
  }
}

export function getOptionalRuntimeConfig(): RuntimeConfigWithAppBranding | undefined {
  return typeof useRuntimeConfig === "function" ? (useRuntimeConfig() as RuntimeConfigWithAppBranding) : undefined
}

