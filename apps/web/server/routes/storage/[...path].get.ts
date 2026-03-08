/**
 * Serve R2 objects via the worker.
 * R2 streams directly to the response — no buffering in worker memory.
 *
 * GET /storage/pdfs/abc-123.pdf → R2 key "pdfs/abc-123.pdf"
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, "path")

  if (!path) {
    throw createError({ statusCode: 400, statusMessage: "Missing path" })
  }

  // Get R2 bucket from Cloudflare binding
  const env = (event.context.cloudflare?.env ?? (globalThis as Record<string, unknown>).__env__) as Cloudflare.Env | undefined
  const bucket = env?.R2_BUCKET

  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: "Storage not available" })
  }

  const object = await bucket.get(path)

  if (!object) {
    throw createError({ statusCode: 404, statusMessage: "Not found" })
  }

  // Set response headers from R2 metadata
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)
  headers.set("cache-control", "public, max-age=31536000, immutable")

  // Set headers on the Nitro response
  for (const [key, value] of headers.entries()) {
    setResponseHeader(event, key, value)
  }

  setResponseStatus(event, 200)
  return object.body
})
