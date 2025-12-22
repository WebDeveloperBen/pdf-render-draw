import type { NitroApp } from "nitropack"
import type { H3Event } from "h3"
import pino from "pino"

/**
 * Server-side logger plugin
 *
 * Uses pino for structured logging. In development, logs are prettified.
 * In production on Cloudflare, logs go to stdout and can be collected
 * via Cloudflare Logpush or Workers Tail.
 */

const createLogger = (level: string) => {
  // In development, use pino-pretty for readable logs
  // In production, use standard JSON output for log aggregation
  const isDev = import.meta.dev

  if (isDev) {
    const transport = pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true
      }
    })

    return pino(
      {
        level: level || "info",
        timestamp: pino.stdTimeFunctions.isoTime
      },
      transport
    )
  }

  // Production: JSON logs to stdout (Cloudflare compatible)
  return pino({
    level: level || "info",
    timestamp: pino.stdTimeFunctions.isoTime
  })
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
