import type { H3Event } from "h3"

/**
 * Cloudflare R2 Storage Utilities
 *
 * Uses Cloudflare's native R2 bindings for better performance on Pages/Workers.
 * Thumbnail generation is handled client-side using PDF.js canvas rendering.
 */

// Type for Cloudflare R2 binding
interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: R2PutOptions): Promise<R2Object>
  get(key: string): Promise<R2ObjectBody | null>
  delete(key: string | string[]): Promise<void>
  head(key: string): Promise<R2Object | null>
  list(options?: R2ListOptions): Promise<R2Objects>
}

interface R2PutOptions {
  httpMetadata?: {
    contentType?: string
    cacheControl?: string
  }
  customMetadata?: Record<string, string>
}

interface R2Object {
  key: string
  size: number
  etag: string
  httpMetadata?: {
    contentType?: string
  }
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
}

interface R2ListOptions {
  prefix?: string
  limit?: number
  cursor?: string
}

interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
}

// Environment with R2 binding
interface CloudflareEnv {
  R2_BUCKET: R2Bucket
}

/**
 * Get the R2 bucket binding from the event context
 * In Cloudflare Pages, bindings are available via event.context.cloudflare.env
 */
export function getR2Bucket(event: H3Event): R2Bucket {
  const env = event.context.cloudflare?.env as CloudflareEnv | undefined

  if (!env?.R2_BUCKET) {
    throw new Error("R2_BUCKET binding not found. Ensure R2 is configured in wrangler.toml")
  }

  return env.R2_BUCKET
}

/**
 * Get the public URL for R2 assets
 * This should be configured as an environment variable pointing to your R2 public domain
 */
export function getR2PublicUrl(): string {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL environment variable not set")
  }
  return publicUrl.replace(/\/$/, "") // Remove trailing slash
}

/**
 * Generate a unique file ID
 */
function generateFileId(): string {
  return crypto.randomUUID()
}

/**
 * Upload a file to Cloudflare R2
 * @param event - H3 event for accessing R2 binding
 * @param file - File data as ArrayBuffer or Uint8Array
 * @param path - Path in the bucket (e.g., 'pdfs/filename.pdf')
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  event: H3Event,
  file: ArrayBuffer | Uint8Array,
  path: string,
  contentType: string
): Promise<string> {
  const bucket = getR2Bucket(event)
  const publicUrl = getR2PublicUrl()

  const data = file instanceof Uint8Array ? new Uint8Array(file).buffer : file
  await bucket.put(path, data as ArrayBuffer, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000" // 1 year cache for immutable assets
    }
  })

  return `${publicUrl}/${path}`
}

/**
 * Delete a file from Cloudflare R2
 * @param event - H3 event for accessing R2 binding
 * @param url - Public URL of the file to delete
 */
export async function deleteFromR2(event: H3Event, url: string): Promise<void> {
  const bucket = getR2Bucket(event)
  const publicUrl = getR2PublicUrl()

  // Extract the path from the URL
  const path = url.replace(`${publicUrl}/`, "")

  await bucket.delete(path)
}

/**
 * Delete multiple files from R2
 * @param event - H3 event for accessing R2 binding
 * @param urls - Array of public URLs to delete
 */
export async function deleteMultipleFromR2(event: H3Event, urls: string[]): Promise<void> {
  const bucket = getR2Bucket(event)
  const publicUrl = getR2PublicUrl()

  const paths = urls.map((url) => url.replace(`${publicUrl}/`, ""))

  await bucket.delete(paths)
}

/**
 * Upload a PDF file to R2
 * Thumbnail generation is handled client-side.
 *
 * @param event - H3 event for accessing R2 binding
 * @param pdfBuffer - PDF file as ArrayBuffer or Uint8Array
 * @param fileName - Original file name
 * @returns Upload result with URL and metadata
 */
export async function uploadPdf(
  event: H3Event,
  pdfBuffer: ArrayBuffer | Uint8Array,
  fileName: string
): Promise<PDFUploadResult> {
  const fileId = generateFileId()
  const fileExt = fileName.split(".").pop() || "pdf"
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 100)

  // Generate path
  const pdfPath = `pdfs/${fileId}.${fileExt}`

  // Upload PDF
  const pdfUrl = await uploadToR2(event, pdfBuffer, pdfPath, "application/pdf")

  // Get file size
  const fileSize = pdfBuffer instanceof Uint8Array ? pdfBuffer.length : pdfBuffer.byteLength

  return {
    pdfUrl,
    thumbnailUrl: "", // Thumbnail generated client-side
    fileName: sanitizedName,
    fileSize,
    pageCount: 0 // Can be determined client-side with PDF.js
  }
}

/**
 * Upload a thumbnail image to R2
 * Called from client after generating thumbnail with PDF.js
 *
 * @param event - H3 event for accessing R2 binding
 * @param imageData - PNG image data as ArrayBuffer or Uint8Array
 * @param projectId - Project ID to associate thumbnail with
 * @returns Public URL of the uploaded thumbnail
 */
export async function uploadThumbnail(
  event: H3Event,
  imageData: ArrayBuffer | Uint8Array,
  projectId: string
): Promise<string> {
  const thumbnailPath = `thumbnails/${projectId}.png`

  return uploadToR2(event, imageData, thumbnailPath, "image/png")
}

/**
 * Check if a file exists in R2
 * @param event - H3 event for accessing R2 binding
 * @param path - Path in the bucket
 * @returns True if file exists
 */
export async function existsInR2(event: H3Event, path: string): Promise<boolean> {
  const bucket = getR2Bucket(event)
  const object = await bucket.head(path)
  return object !== null
}
