import type { NitroApp } from "nitropack"
import { ZodError, type ZodIssue } from "zod"

interface H3ErrorLike extends Error {
  statusCode?: number
  statusMessage?: string
  data?: unknown
}

/**
 * Global error handler plugin for Nitro
 *
 * Responsibilities:
 * 1. Log all errors to console (serverless compatible, OTel can capture)
 * 2. Parse Zod validation errors into user-friendly messages
 *
 * @see docs/API_ERROR_HANDLING.md for full documentation
 */
export default defineNitroPlugin((nitroApp: NitroApp) => {
  nitroApp.hooks.hook("error", async (error, { event }) => {
    const h3Error = error as H3ErrorLike
    const isZodError = h3Error.cause instanceof ZodError

    // Log all errors to console for debugging
    console.error("[API Error]", {
      url: event?.path,
      method: event?.method,
      statusCode: h3Error.statusCode || 500,
      type: isZodError ? "validation" : "server",
      message: h3Error.message,
      ...(h3Error.statusCode === 500 && { stack: h3Error.stack })
    })

    // Parse Zod validation errors into readable format
    if (isZodError) {
      const zodError = h3Error.cause as ZodError
      const issues: ZodIssue[] = zodError.issues
      const messages = issues.map((e) => {
        const field = e.path.join(".")
        return field ? `${field}: ${e.message}` : e.message
      })

      h3Error.statusCode = 400
      h3Error.statusMessage = "Validation Error"
      h3Error.data = {
        type: "VALIDATION_ERROR",
        message: messages.join(", "),
        fields: issues.map((e) => ({
          field: e.path.join("."),
          message: e.message
        }))
      }
    }
  })
})
