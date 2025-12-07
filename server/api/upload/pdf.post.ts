import { auth } from "@auth"

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized - authentication required"
    })
  }

  // Parse multipart form data
  const form = await readMultipartFormData(event)

  if (!form) {
    throw createError({
      statusCode: 400,
      statusMessage: "No form data provided"
    })
  }

  // Find the PDF file in the form data
  const pdfFile = form.find((item) => item.name === "pdf")

  if (!pdfFile) {
    throw createError({
      statusCode: 400,
      statusMessage: "No PDF file provided"
    })
  }

  // Validate file type
  const allowedTypes = ["application/pdf"]
  if (!allowedTypes.includes(pdfFile.type || "")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid file type. Only PDF files are allowed."
    })
  }

  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024 // 50MB in bytes
  if (pdfFile.data.length > maxSize) {
    throw createError({
      statusCode: 400,
      statusMessage: "File too large. Maximum size is 50MB."
    })
  }

  try {
    // Upload PDF and generate thumbnail
    const result = await uploadPdfWithThumbnail(Buffer.from(pdfFile.data), pdfFile.filename || "document.pdf")

    return result
  } catch (error) {
    console.error("Error uploading PDF:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to upload PDF. Please try again."
    })
  }
})
