import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@auth"
import { deleteFromR2 } from "../../utils/r2"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Projects"],
    summary: "Delete Project",
    description: "Delete a project permanently",
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
        description: "Project deleted successfully",
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
      403: { description: "Forbidden - insufficient permissions or access denied" },
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

  // Check permission to delete projects
  await requirePermission(event, { project: ["delete"] })

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

  // Fetch the project
  const [existingProject] = await db.select().from(project).where(eq(project.id, projectId))

  if (!existingProject) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: project must belong to active organization
  if (existingProject.organizationId !== activeOrgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Delete files from R2
  try {
    await deleteFromR2(event, existingProject.pdfUrl)

    if (existingProject.thumbnailUrl) {
      await deleteFromR2(event, existingProject.thumbnailUrl)
    }
  } catch (error) {
    console.error("Failed to delete files from R2:", error)
    // Continue with database deletion even if R2 deletion fails
  }

  // Delete project (cascade will delete shares)
  await db.delete(project).where(eq(project.id, projectId))

  return {
    success: true,
    message: "Project deleted successfully"
  }
})
