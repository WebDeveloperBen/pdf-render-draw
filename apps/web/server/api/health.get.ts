/**
 * Health check endpoint for Fly.io
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     description: Returns server health status
 *     responses:
 *       200:
 *         description: Server is healthy
 */
export default defineEventHandler(() => {
  return {
    status: "ok",
    timestamp: new Date().toISOString()
  }
})
