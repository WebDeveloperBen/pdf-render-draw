import { auth } from "@auth"
import { uploadPdf } from "../../utils/r2"

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Upload"],
    summary: "Upload PDF",
    description: "Upload a PDF file. Thumbnail is generated client-side.",
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: {
              pdf: {
                type: "string",
                format: "binary",
                description: "PDF file to upload (max 50MB)"
              }
            },
            required: ["pdf"]
          }
        }
      }
    },
    responses: {
      200: {
        description: "PDF uploaded successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                pdfUrl: { type: "string" },
                thumbnailUrl: { type: "string" },
                pageCount: { type: "number" },
                fileName: { type: "string" },
                fileSize: { type: "number" }
              },
              required: ["pdfUrl", "thumbnailUrl", "pageCount", "fileName", "fileSize"]
            }
          }
        }
      },
      400: {
        description: "Bad request - invalid file type, size, or no file provided"
      },
      401: { description: "Unauthorized - authentication required" },
      500: { description: "Internal server error - upload failed" }
    }
  }
})

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
    // Upload PDF (thumbnail generated client-side)
    const result = await uploadPdf(pdfFile.data, pdfFile.filename || "document.pdf")

    return result
  } catch (error) {
    console.error("Error uploading PDF:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to upload PDF. Please try again."
    })
  }
})
