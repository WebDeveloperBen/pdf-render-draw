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
  const env = (event.context.cloudflare?.env ?? (globalThis as Record<string, unknown>).__env__) as unknown as
    | Cloudflare.Env
    | undefined
  const bucket = env?.R2_BUCKET

  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: "Storage not available" })
  }

  const object = await bucket.get(path)

  if (!object) {
    throw createError({ statusCode: 404, statusMessage: "Not found" })
  }

  // Infer content-type from path extension (writeHttpMetadata doesn't work with miniflare proxy)
  const ext = path.split(".").pop()?.toLowerCase()
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml"
  }

  setResponseHeader(event, "content-type", contentTypes[ext || ""] || "application/octet-stream")
  setResponseHeader(event, "cache-control", "public, max-age=31536000, immutable")
  if (object.httpEtag) setResponseHeader(event, "etag", object.httpEtag)

  setResponseStatus(event, 200)
  return object.body
})
