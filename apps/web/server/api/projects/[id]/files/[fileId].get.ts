import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" }),
  fileId: z.uuid({ message: "Invalid file ID" })
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Project Files"],
    summary: "Get Project File",
    description: "Get a specific file from a project with user-specific viewport state",
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
    responses: {
      200: {
        description: "File details with user-specific viewport state",
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
                lastViewedAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true
                },
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
                },
                viewportState: {
                  type: "object",
                  nullable: true,
                  description: "User-specific viewport preferences for this file",
                  properties: {
                    scale: { type: "number" },
                    rotation: { type: "number" },
                    scrollLeft: { type: "number" },
                    scrollTop: { type: "number" },
                    currentPage: { type: "number" }
                  }
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
      400: { description: "Bad request - no active organization" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - access denied" },
      404: { description: "Project or file not found" }
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

  // Validate route params
  const { id: projectId, fileId } = await getValidatedRouterParams(event, paramsSchema.parse)

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

  // Get the file with uploader info
  const [file] = await db
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
    .where(and(eq(projectFile.id, fileId), eq(projectFile.projectId, projectId)))

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: "File not found"
    })
  }

  // Get user-specific viewport state
  const [viewportStateData] = await db
    .select({
      scale: userFileState.viewportScale,
      rotation: userFileState.viewportRotation,
      scrollLeft: userFileState.viewportScrollLeft,
      scrollTop: userFileState.viewportScrollTop,
      currentPage: userFileState.viewportCurrentPage
    })
    .from(userFileState)
    .where(and(eq(userFileState.userId, session.user.id), eq(userFileState.fileId, fileId)))

  return {
    ...file,
    viewportState: viewportStateData || null
  }
})
