interface Logger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

export default defineNuxtPlugin({
  name: "client-logger",
  setup() {
    const {
      public: {
        logger: {
          client: { level }
        }
      }
    } = useRuntimeConfig()

    const shouldLog = (msgLevel: string): boolean => {
      const levels = ["debug", "info", "warn", "error"]
      return levels.indexOf(msgLevel) >= levels.indexOf(level)
    }

    const logger: Logger = {
      info: (...args) => shouldLog("info") && console.log("[INFO]", ...args),
      warn: (...args) => shouldLog("warn") && console.warn("[WARN]", ...args),
      error: (...args) => shouldLog("error") && console.error("[ERROR]", ...args),
      debug: (...args) => shouldLog("debug") && console.debug("[DEBUG]", ...args)
    }

    return {
      provide: {
        logger
      }
    }
  }
})
