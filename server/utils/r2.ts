import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3"

/**
 * Cloudflare R2 Storage Utilities
 *
 * Uses AWS S3 SDK to access R2 via S3-compatible API.
 * Works from any hosting provider (Fly.io, Railway, etc.)
 */

// Lazy-initialized S3 client
let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY")
  }

  _s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  })

  return _s3Client
}

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME environment variable not set")
  }
  return bucketName
}

/**
 * Get the public URL for R2 assets
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
 * @param file - File data as ArrayBuffer or Uint8Array
 * @param path - Path in the bucket (e.g., 'pdfs/filename.pdf')
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(
  file: ArrayBuffer | Uint8Array,
  path: string,
  contentType: string
): Promise<string> {
  const client = getS3Client()
  const bucketName = getBucketName()
  const publicUrl = getR2PublicUrl()

  const body = file instanceof Uint8Array ? file : new Uint8Array(file)

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000" // 1 year cache for immutable assets
    })
  )

  return `${publicUrl}/${path}`
}

/**
 * Delete a file from Cloudflare R2
 * @param url - Public URL of the file to delete
 */
export async function deleteFromR2(url: string): Promise<void> {
  const client = getS3Client()
  const bucketName = getBucketName()
  const publicUrl = getR2PublicUrl()

  const path = url.replace(`${publicUrl}/`, "")

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: path
    })
  )
}

/**
 * Delete multiple files from R2
 * @param urls - Array of public URLs to delete
 */
export async function deleteMultipleFromR2(urls: string[]): Promise<void> {
  const client = getS3Client()
  const bucketName = getBucketName()
  const publicUrl = getR2PublicUrl()

  const objects = urls.map((url) => ({
    Key: url.replace(`${publicUrl}/`, "")
  }))

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: { Objects: objects }
    })
  )
}

/**
 * Upload a PDF file to R2
 * Thumbnail generation is handled client-side.
 *
 * @param pdfBuffer - PDF file as ArrayBuffer or Uint8Array
 * @param fileName - Original file name
 * @returns Upload result with URL and metadata
 */
export async function uploadPdf(
  pdfBuffer: ArrayBuffer | Uint8Array,
  fileName: string
): Promise<PDFUploadResult> {
  const fileId = generateFileId()
  const fileExt = fileName.split(".").pop() || "pdf"
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 100)

  // Generate path
  const pdfPath = `pdfs/${fileId}.${fileExt}`

  // Upload PDF
  const pdfUrl = await uploadToR2(pdfBuffer, pdfPath, "application/pdf")

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
 * @param imageData - PNG image data as ArrayBuffer or Uint8Array
 * @param projectId - Project ID to associate thumbnail with
 * @returns Public URL of the uploaded thumbnail
 */
export async function uploadThumbnail(imageData: ArrayBuffer | Uint8Array, projectId: string): Promise<string> {
  const thumbnailPath = `thumbnails/${projectId}.png`
  return uploadToR2(imageData, thumbnailPath, "image/png")
}

/**
 * Check if a file exists in R2
 * @param path - Path in the bucket
 * @returns True if file exists
 */
export async function existsInR2(path: string): Promise<boolean> {
  const client = getS3Client()
  const bucketName = getBucketName()

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: path
      })
    )
    return true
  } catch {
    return false
  }
}
