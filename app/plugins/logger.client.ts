import pino from "pino"

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

    const logger = pino({
      browser: {
        asObject: true
      },
      level,
      timestamp: pino.stdTimeFunctions.isoTime
    })

    return {
      provide: {
        logger
      }
    }
  }
})
