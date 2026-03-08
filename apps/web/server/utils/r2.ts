/**
 * Cloudflare R2 Storage Utilities
 *
 * Two modes:
 * - Cloudflare Workers: Uses native R2 bindings (zero SDK, fast)
 * - Node.js (local dev / MinIO): Uses AWS S3 SDK via S3-compatible API
 */

// ── Types ──

interface R2StorageClient {
  put(key: string, body: Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<void>
  delete(key: string | string[]): Promise<void>
  head(key: string): Promise<object | null>
}

// ── Cloudflare R2 Binding Adapter ──

function getCloudflareR2Bucket(): R2StorageClient | null {
  try {
    const env = (globalThis as Record<string, unknown>).__env__ as Cloudflare.Env | undefined
    if (env?.R2_BUCKET && typeof env.R2_BUCKET.put === "function") return env.R2_BUCKET as unknown as R2StorageClient
  } catch {}

  try {
    const event = useEvent()
    const env = event.context.cloudflare?.env as Cloudflare.Env | undefined
    if (env?.R2_BUCKET) return env.R2_BUCKET as unknown as R2StorageClient
  } catch {}

  return null
}

// ── S3 SDK Adapter (for local dev / MinIO) ──

let _s3Client: R2StorageClient | null = null

async function getS3Client(): Promise<R2StorageClient> {
  if (_s3Client) return _s3Client

  // Dynamic import so the AWS SDK is tree-shaken out of the Cloudflare bundle
  const { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } =
    await import("@aws-sdk/client-s3")

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = getBucketName()

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY")
  }

  // Support MinIO (S3_ENDPOINT env) or Cloudflare R2
  const endpoint = process.env.S3_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: !!process.env.S3_ENDPOINT // MinIO needs path-style
  })

  _s3Client = {
    async put(key, body, options) {
      await client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: options?.httpMetadata?.contentType,
        CacheControl: "public, max-age=31536000"
      }))
    },
    async delete(key) {
      if (Array.isArray(key)) {
        await client.send(new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: key.map(k => ({ Key: k })) }
        }))
      } else {
        await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
      }
    },
    async head(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
        return {}
      } catch {
        return null
      }
    }
  }

  return _s3Client
}

// ── Unified Client ──

async function getStorageClient(): Promise<R2StorageClient> {
  const cfBucket = getCloudflareR2Bucket()
  if (cfBucket) return cfBucket
  return getS3Client()
}

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME
  if (!bucketName) throw new Error("R2_BUCKET_NAME environment variable not set")
  return bucketName
}

/**
 * Get the public URL for R2 assets
 */
export function getR2PublicUrl(): string {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (!publicUrl) throw new Error("R2_PUBLIC_URL environment variable not set")
  return publicUrl.replace(/\/$/, "")
}

/**
 * Upload a file to R2
 */
export async function uploadToR2(file: ArrayBuffer | Uint8Array, path: string, contentType: string): Promise<string> {
  const client = await getStorageClient()
  const publicUrl = getR2PublicUrl()
  const body = file instanceof Uint8Array ? file : new Uint8Array(file)

  await client.put(path, body, { httpMetadata: { contentType } })
  return `${publicUrl}/${path}`
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(url: string): Promise<void> {
  const client = await getStorageClient()
  const publicUrl = getR2PublicUrl()
  const path = url.replace(`${publicUrl}/`, "")
  await client.delete(path)
}

/**
 * Delete multiple files from R2
 */
export async function deleteMultipleFromR2(urls: string[]): Promise<void> {
  const client = await getStorageClient()
  const publicUrl = getR2PublicUrl()
  const keys = urls.map(url => url.replace(`${publicUrl}/`, ""))
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
  const client = await getStorageClient()
  const result = await client.head(path)
  return result !== null
}
