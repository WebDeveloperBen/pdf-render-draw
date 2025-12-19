import { z } from "zod"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

const bodySchema = z.object({
  password: z.string().min(4, "Password must be at least 4 characters").nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  allowDownload: z.boolean().default(true),
  allowAnnotations: z.boolean().default(false)
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

  // Check permission to share projects
  await requirePermission(event, { project: ["share"] })

  // Validate route params and body
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

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
      expiresAt: body.expiresAt ?? null,
      password: hashedPassword,
      allowDownload: body.allowDownload,
      allowAnnotations: body.allowAnnotations,
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
