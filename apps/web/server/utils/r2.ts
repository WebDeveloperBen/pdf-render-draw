/**
 * Cloudflare R2 Storage Utilities
 *
 * Files are stored in R2 and served via /storage/[...path] worker route.
 * URLs stored in DB use the origin + /storage/ prefix (e.g. https://example.com/storage/pdfs/abc.pdf)
 */

// ── Types ──

interface R2StorageClient {
  put(
    key: string,
    body: Uint8Array,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  ): Promise<void>
  delete(key: string | string[]): Promise<void>
  head(key: string): Promise<object | null>
}

// ── Cloudflare R2 Binding ──

function getR2Bucket(): R2StorageClient {
  // Try globalThis.__env__ (set by nitro-cloudflare-dev in dev, Workers runtime in prod)
  try {
    const env = (globalThis as Record<string, unknown>).__env__ as unknown as Cloudflare.Env | undefined
    if (env?.R2_BUCKET && typeof env.R2_BUCKET.put === "function") return env.R2_BUCKET as unknown as R2StorageClient
  } catch {}

  // Try event.context.cloudflare.env (nitro-cloudflare-dev plugin)
  try {
    const event = useEvent()
    const env = event.context.cloudflare?.env as unknown as Cloudflare.Env | undefined
    if (env?.R2_BUCKET) return env.R2_BUCKET as unknown as R2StorageClient
  } catch {}

  throw new Error(
    "[R2] No R2 binding available. Ensure wrangler.toml has r2_buckets configured and nitro-cloudflare-dev is loaded."
  )
}

/**
 * Get the origin URL for building storage URLs.
 * Uses the current request's origin so URLs work in any environment.
 */
function getStorageOrigin(): string {
  try {
    const event = useEvent()
    const host = getRequestHost(event, { xForwardedHost: true })
    const protocol = getRequestProtocol(event, { xForwardedProto: true })
    return `${protocol}://${host}`
  } catch {
    // Fallback for non-request contexts
    return process.env.BETTER_AUTH_URL || "http://localhost:3000"
  }
}

/**
 * Convert a storage URL back to an R2 key.
 * Handles both /storage/ relative paths and full URLs.
 */
function urlToR2Key(url: string): string {
  // Full URL: https://example.com/storage/pdfs/abc.pdf → pdfs/abc.pdf
  const storageIdx = url.indexOf("/storage/")
  if (storageIdx !== -1) return url.slice(storageIdx + "/storage/".length)
  // Legacy full R2 public URL: https://pdf-dev.bens.digital/pdfs/abc.pdf
  // Try stripping origin
  try {
    const parsed = new URL(url)
    return parsed.pathname.replace(/^\//, "")
  } catch {
    return url
  }
}

/**
 * Upload a file to R2
 */
export async function uploadToR2(file: ArrayBuffer | Uint8Array, path: string, contentType: string): Promise<string> {
  const client = getR2Bucket()
  const origin = getStorageOrigin()
  // Ensure a plain Uint8Array (not Buffer subclass) — miniflare's proxy can't serialize Buffer
  const body = new Uint8Array(
    file instanceof ArrayBuffer ? file : file.buffer,
    file instanceof ArrayBuffer ? 0 : file.byteOffset,
    file instanceof ArrayBuffer ? file.byteLength : file.byteLength
  )

  await client.put(path, body, { httpMetadata: { contentType } })
  return `${origin}/storage/${path}`
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(url: string): Promise<void> {
  const client = getR2Bucket()
  const key = urlToR2Key(url)
  await client.delete(key)
}

/**
 * Delete multiple files from R2
 */
export async function deleteMultipleFromR2(urls: string[]): Promise<void> {
  const client = getR2Bucket()
  const keys = urls.map(urlToR2Key)
  await client.delete(keys)
}

/**
 * Upload a PDF file to R2
 */
export async function uploadPdf(pdfBuffer: ArrayBuffer | Uint8Array, fileName: string): Promise<PDFUploadResult> {
  const fileId = crypto.randomUUID()
  const fileExt = fileName.split(".").pop() || "pdf"
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 100)
  const pdfPath = `pdfs/${fileId}.${fileExt}`
  const pdfUrl = await uploadToR2(pdfBuffer, pdfPath, "application/pdf")
  const fileSize = pdfBuffer instanceof Uint8Array ? pdfBuffer.length : pdfBuffer.byteLength

  return {
    pdfUrl,
    thumbnailUrl: "",
    fileName: sanitizedName,
    fileSize,
    pageCount: 0
  }
}

/**
 * Upload a thumbnail image to R2
 */
export async function uploadThumbnail(imageData: ArrayBuffer | Uint8Array, projectId: string): Promise<string> {
  const thumbnailPath = `thumbnails/${projectId}.png`
  return uploadToR2(imageData, thumbnailPath, "image/png")
}

/**
 * Check if a file exists in R2
 */
export async function existsInR2(path: string): Promise<boolean> {
  const client = getR2Bucket()
  const result = await client.head(path)
  return result !== null
}
