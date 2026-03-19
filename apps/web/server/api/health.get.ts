defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Health Check",
    description: "Return basic service health status",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["ok"] },
                timestamp: { type: "string", format: "date-time" }
              },
              required: ["status", "timestamp"]
            }
          }
        }
      }
    }
  }
})

export default defineEventHandler(() => {
  return {
    status: "ok",
    timestamp: new Date().toISOString()
  }
})
