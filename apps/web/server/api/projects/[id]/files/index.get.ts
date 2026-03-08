import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Project Files"],
    summary: "List Project Files",
    description: "Get all files for a specific project",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID (UUID)"
      }
    ],
    responses: {
      200: {
        description: "List of files",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
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
        }
      },
      400: { description: "Bad request - no active organization" },
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

  // Validate route params
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)

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

  // Get all files for this project ordered by createdAt
  const files = await db
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
    .where(eq(projectFile.projectId, projectId))
    .orderBy(projectFile.createdAt)

  return files
})
