import { randomUUID } from "crypto"
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

  // Only creator can create shares
  if (projectData.createdBy !== session.user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only project creator can create shares."
    })
  }

  const body = await readBody(event)

  // Hash password if provided
  let hashedPassword: string | null = null
  if (body.password) {
    // Simple hash for demo - in production, use bcrypt or similar
    const crypto = await import("crypto")
    hashedPassword = crypto.createHash("sha256").update(body.password).digest("hex")
  }

  // Generate unique token
  const token = randomUUID()
  const shareId = randomUUID()

  // Create share
  await db
    .insert(projectShare)
    .values({
      id: shareId,
      projectId,
      token,
      createdBy: session.user.id,
      expiresAt: body.expiresAt || null,
      password: hashedPassword,
      allowDownload: body.allowDownload ?? true,
      allowAnnotations: body.allowAnnotations ?? false,
      viewCount: 0,
      lastViewedAt: null
    })
    .returning()

  // Fetch share with creator info
  const [shareWithCreator] = await db
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
    .where(eq(projectShare.id, shareId))

  // Generate shareable URL
  const baseUrl = process.env.BASE_URL || "http://localhost:3000"
  const shareUrl = `${baseUrl}/share/${token}`

  setResponseStatus(event, 201)
  return {
    ...shareWithCreator,
    shareUrl
  }
})
