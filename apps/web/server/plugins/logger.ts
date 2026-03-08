import type { NitroApp } from "nitropack"
import type { H3Event } from "h3"

/**
 * Server-side logger plugin
 *
 * Uses console for Cloudflare Pages compatibility.
 * Logs are collected via Cloudflare's built-in logging or Workers Tail.
 */

interface Logger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

const createLogger = (_level: string): Logger => {
  // Simple console-based logger for edge runtime compatibility
  return {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    debug: (...args) => {
      if (import.meta.dev) console.debug("[DEBUG]", ...args)
    }
  }
}

// Nitro server plugin
export default defineNitroPlugin((nitroApp: NitroApp) => {
  const {
    logger: {
      server: { level }
    }
  } = useRuntimeConfig()
  const logger = createLogger(level)

  // Make logger available via event context
  nitroApp.hooks.hook("request", (event: H3Event) => {
    event.context.logger = logger
  })
})
