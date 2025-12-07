import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

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
  const shareId = getRouterParam(event, "shareId")

  if (!projectId || !shareId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Project ID and Share ID are required"
    })
  }

  // Check if share exists
  const [share] = await db
    .select()
    .from(projectShare)
    .where(and(eq(projectShare.id, shareId), eq(projectShare.projectId, projectId)))

  if (!share) {
    throw createError({
      statusCode: 404,
      statusMessage: "Share not found"
    })
  }

  // Check if user is the creator of the share
  const [projectData] = await db.select().from(project).where(eq(project.id, projectId))

  if (share.createdBy !== session.user.id && projectData.createdBy !== session.user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only share creator or project owner can revoke shares."
    })
  }

  // Delete share
  await db.delete(projectShare).where(eq(projectShare.id, shareId))

  return {
    success: true,
    message: "Share revoked successfully"
  }
})
