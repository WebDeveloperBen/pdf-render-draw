import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
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

  // Check if user has permission to delete (creator or owner)
  let hasAccess = existingProject.createdBy === session.user.id

  if (!hasAccess) {
    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, activeOrgId)))
      .limit(1)

    const userMembership = membership[0]
    if (userMembership) {
      // Only owner can delete projects (not just admins)
      hasAccess = userMembership.role === "owner"
    }
  }

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only project creator or organization owner can delete projects."
    })
  }

  // Delete files from R2
  try {
    await deleteFromR2(existingProject.pdfUrl)

    if (existingProject.thumbnailUrl) {
      await deleteFromR2(existingProject.thumbnailUrl)
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
