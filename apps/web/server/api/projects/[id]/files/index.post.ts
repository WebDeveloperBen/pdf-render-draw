import { z } from "zod"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@auth"
import { requirePermission } from "../../../../utils/permissions"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

const bodySchema = z.object({
  pdfUrl: z.url({ message: "Invalid PDF URL" }),
  pdfFileName: z.string().min(1, "File name is required"),
  pdfFileSize: z.number().positive("File size must be positive"),
  pageCount: z.number().int().min(0).default(0)
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Project Files"],
    summary: "Add File to Project",
    description: "Add a new file to a project",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID (UUID)"
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              pdfUrl: {
                type: "string",
                format: "uri",
                description: "URL to the PDF file"
              },
              pdfFileName: {
                type: "string",
                description: "Original PDF file name"
              },
              pdfFileSize: {
                type: "number",
                description: "PDF file size in bytes"
              },
              pageCount: {
                type: "integer",
                default: 1,
                description: "Number of pages in the PDF"
              }
            },
            required: ["pdfUrl", "pdfFileName", "pdfFileSize"]
          }
        }
      }
    },
    responses: {
      201: {
        description: "File added successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                projectId: { type: "string" },
                pdfUrl: { type: "string" },
                pdfFileName: { type: "string" },
                pdfFileSize: { type: "number" },
                pageCount: { type: "number" },
                annotationCount: { type: "number" },
                uploadedBy: { type: "string" },
                lastViewedAt: { type: "string", format: "date-time", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                uploader: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    image: { type: "string", nullable: true }
                  },
                  required: ["id", "name", "email"]
                }
              },
              required: [
                "id",
                "projectId",
                "pdfUrl",
                "pdfFileName",
                "pdfFileSize",
                "pageCount",
                "annotationCount",
                "uploadedBy",
                "createdAt",
                "updatedAt",
                "uploader"
              ]
            }
          }
        }
      },
      400: { description: "Bad request - validation error or no active organization" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - access denied" },
      404: { description: "Project not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  await requirePermission(event, { project: ["update"] })

  // Validate route params and body
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  // Get active organization
  const activeOrgId = session.session.activeOrganizationId

  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  const db = useDrizzle()

  // Check if project exists
  const [projectData] = await db.select().from(project).where(eq(project.id, projectId))

  if (!projectData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: project must belong to active organization
  if (projectData.organizationId !== activeOrgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Create the file
  const fileId = randomUUID()

  await db.insert(projectFile).values({
    id: fileId,
    projectId,
    pdfUrl: body.pdfUrl,
    pdfFileName: body.pdfFileName,
    pdfFileSize: body.pdfFileSize,
    pageCount: body.pageCount,
    annotationCount: 0,
    uploadedBy: session.user.id,
    lastViewedAt: null
  })

  // Fetch the file with uploader info
  const [fileWithUploader] = await db
    .select({
      id: projectFile.id,
      projectId: projectFile.projectId,
      pdfUrl: projectFile.pdfUrl,
      pdfFileName: projectFile.pdfFileName,
      pdfFileSize: projectFile.pdfFileSize,
      pageCount: projectFile.pageCount,
      annotationCount: projectFile.annotationCount,
      uploadedBy: projectFile.uploadedBy,
      lastViewedAt: projectFile.lastViewedAt,
      createdAt: projectFile.createdAt,
      updatedAt: projectFile.updatedAt,
      uploader: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      }
    })
    .from(projectFile)
    .leftJoin(user, eq(projectFile.uploadedBy, user.id))
    .where(eq(projectFile.id, fileId))

  setResponseStatus(event, 201)
  return fileWithUploader
})
