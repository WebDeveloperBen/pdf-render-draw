import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
})

const bucketName = process.env.R2_BUCKET_NAME!
const publicUrl = process.env.R2_PUBLIC_URL!

/**
 * Upload a file to Cloudflare R2
 * @param file - File buffer to upload
 * @param path - Path in the bucket (e.g., 'pdfs/filename.pdf')
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToR2(file: Buffer, path: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: path,
    Body: file,
    ContentType: contentType
  })

  await r2Client.send(command)

  // Return public URL
  return `${publicUrl}/${path}`
}

/**
 * Delete a file from Cloudflare R2
 * @param url - Public URL of the file to delete
 */
export async function deleteFromR2(url: string): Promise<void> {
  // Extract the path from the URL
  const path = url.replace(`${publicUrl}/`, "")

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: path
  })

  await r2Client.send(command)
}

/**
 * Generate a thumbnail from a PDF buffer
 * @param pdfBuffer - PDF file buffer
 * @returns Thumbnail image buffer (PNG)
 */
export async function generatePdfThumbnail(pdfBuffer: Buffer): Promise<Buffer> {
  // Dynamic import of PDF.js to avoid ESM issues
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/"
  })

  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)

  // Set up viewport for thumbnail (max width 400px)
  const viewport = page.getViewport({ scale: 1.0 })
  const scale = 400 / viewport.width
  const scaledViewport = page.getViewport({ scale })

  // Create canvas
  // Note: This requires canvas to be installed
  // For Node.js environment, we'll use a simple approach
  // In production, you might want to use sharp or another image processing library
  const { createCanvas } = await import("canvas")
  const canvas = createCanvas(scaledViewport.width, scaledViewport.height)
  const context = canvas.getContext("2d")

  // Render PDF page to canvas
  // Using 'as any' because node-canvas types don't match browser types that pdfjs expects
  await page.render({
    canvasContext: context as any,
    viewport: scaledViewport,
    canvas: canvas as any
  }).promise

  // Convert canvas to PNG buffer
  return canvas.toBuffer("image/png")
}

/**
 * Get the page count from a PDF buffer
 * @param pdfBuffer - PDF file buffer
 * @returns Number of pages in the PDF
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true
  })

  const pdf = await loadingTask.promise
  return pdf.numPages
}

/**
 * Upload a PDF file and its thumbnail to R2
 * @param pdfBuffer - PDF file buffer
 * @param fileName - Original file name
 * @returns Upload result with URLs and metadata
 */
export async function uploadPdfWithThumbnail(pdfBuffer: Buffer, fileName: string): Promise<PDFUploadResult> {
  const fileId = randomUUID()
  const fileExt = fileName.split(".").pop() || "pdf"
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 100)

  // Generate paths
  const pdfPath = `pdfs/${fileId}.${fileExt}`
  const thumbnailPath = `thumbnails/${fileId}.png`

  // Upload PDF
  const pdfUrl = await uploadToR2(pdfBuffer, pdfPath, "application/pdf")

  // Generate and upload thumbnail
  let thumbnailUrl: string
  try {
    const thumbnailBuffer = await generatePdfThumbnail(pdfBuffer)
    thumbnailUrl = await uploadToR2(thumbnailBuffer, thumbnailPath, "image/png")
  } catch (error) {
    console.error("Failed to generate thumbnail:", error)
    // If thumbnail generation fails, return without thumbnail
    thumbnailUrl = ""
  }

  // Get page count
  const pageCount = await getPdfPageCount(pdfBuffer)

  return {
    pdfUrl,
    thumbnailUrl,
    fileName: sanitizedName,
    fileSize: pdfBuffer.length,
    pageCount
  }
}
