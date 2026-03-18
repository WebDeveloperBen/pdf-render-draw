import { z } from "zod"
import { eq, and } from "drizzle-orm"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" }),
  fileId: z.uuid({ message: "Invalid file ID" })
})

const bodySchema = z.object({
  annotationCount: z.number().int().min(0).optional(),
  lastViewedAt: z.coerce.date().optional()
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Project Files"],
    summary: "Update Project File",
    description: "Update a file in a project (annotation count, last viewed)",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID (UUID)"
      },
      {
        name: "fileId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "File ID (UUID)"
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              annotationCount: {
                type: "integer",
                minimum: 0,
                description: "Number of annotations on the file"
              },
              lastViewedAt: {
                type: "string",
                format: "date-time",
                description: "Last time the file was viewed"
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "File updated successfully",
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
      404: { description: "Project or file not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { orgId } = await requireActiveOrg(event)

  // Validate route params and body
  const { id: projectId, fileId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

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
  if (projectData.organizationId !== orgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Check if file exists
  const [existingFile] = await db
    .select()
    .from(projectFile)
    .where(and(eq(projectFile.id, fileId), eq(projectFile.projectId, projectId)))

  if (!existingFile) {
    throw createError({
      statusCode: 404,
      statusMessage: "File not found"
    })
  }

  // Build update object
  const updateData: Partial<typeof existingFile> = {}
  if (body.annotationCount !== undefined) {
    updateData.annotationCount = body.annotationCount
  }
  if (body.lastViewedAt !== undefined) {
    updateData.lastViewedAt = body.lastViewedAt
  }

  // Update the file if there are changes
  if (Object.keys(updateData).length > 0) {
    await db.update(projectFile).set(updateData).where(eq(projectFile.id, fileId))
  }

  // Fetch the updated file with uploader info
  const [updatedFile] = await db
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

  return updatedFile
})
