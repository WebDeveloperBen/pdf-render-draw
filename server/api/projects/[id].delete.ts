import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

/**
 * @openapi
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     description: Delete a project and its associated files (requires creator or organization owner role)
 *     tags:
 *       - Projects
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Project not found
 */
export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()
  const projectId = getRouterParam(event, "id")

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Project ID is required"
    })
  }

  // Fetch the project
  const [existingProject] = await db.select().from(project).where(eq(project.id, projectId))

  if (!existingProject) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: user must be creator OR organization owner
  let hasAccess = existingProject.createdBy === session.user.id

  if (!hasAccess && existingProject.organizationId) {
    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, existingProject.organizationId)))
      .limit(1)

    if (membership.length > 0) {
      // Only owner can delete projects
      hasAccess = membership[0].role === "owner"
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
