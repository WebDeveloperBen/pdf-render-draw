import type { NitroApp } from "nitropack"
import type { H3Event } from "h3"
import pino from "pino"

// Create server-side logger instance
const createLogger = (level: string) => {
  const transport = pino.transport({
    targets: [
      {
        target: "pino-pretty",
        level: "trace",
        options: {}
      },
      {
        target: "pino/file",
        options: { destination: `./app.log` },
        level: "trace"
      }
    ]
  })

  return pino(
    {
      level: level || "info",
      timestamp: pino.stdTimeFunctions.isoTime
    },
    transport
  )
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
