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
    summary: "Delete Project File",
    description: "Remove a file from a project",
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
        description: "File deleted successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" }
              },
              required: ["success", "message"]
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

  // TODO: Delete file from R2 storage
  // const r2 = useR2()
  // await r2.delete(existingFile.pdfUrl)

  // Delete the file record
  await db.delete(projectFile).where(eq(projectFile.id, fileId))

  return {
    success: true,
    message: "File deleted successfully"
  }
})
