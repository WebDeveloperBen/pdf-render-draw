import { eq } from "drizzle-orm"
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

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Project ID is required"
    })
  }

  // Check if project exists and user has access
  const [projectData] = await db.select().from(project).where(eq(project.id, projectId))

  if (!projectData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Only creator can view shares
  if (projectData.createdBy !== session.user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only project creator can view shares."
    })
  }

  // Get all shares for this project
  const shares = await db
    .select({
      id: projectShare.id,
      projectId: projectShare.projectId,
      token: projectShare.token,
      createdBy: projectShare.createdBy,
      expiresAt: projectShare.expiresAt,
      password: projectShare.password,
      allowDownload: projectShare.allowDownload,
      allowAnnotations: projectShare.allowAnnotations,
      viewCount: projectShare.viewCount,
      lastViewedAt: projectShare.lastViewedAt,
      createdAt: projectShare.createdAt,
      updatedAt: projectShare.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })
    .from(projectShare)
    .leftJoin(user, eq(projectShare.createdBy, user.id))
    .where(eq(projectShare.projectId, projectId))

  return shares
})
