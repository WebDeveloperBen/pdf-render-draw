import { z } from "zod"
import { eq, inArray } from "drizzle-orm"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Project Shares"],
    summary: "List Project Shares",
    description: "Get all shares for a specific project",
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
        description: "List of shares with recipients",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object"
              }
            }
          }
        }
      },
      400: { description: "Bad request - no active organization" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - access denied or not project creator" },
      404: { description: "Project not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { user: authUser, orgId } = await requireActiveOrg(event)

  // Validate route params
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)

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
  if (projectData.organizationId !== orgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Only creator can view shares
  if (projectData.createdBy !== authUser.id) {
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
      name: projectShare.name,
      shareType: projectShare.shareType,
      message: projectShare.message,
      expiresAt: projectShare.expiresAt,
      password: projectShare.password,
      allowDownload: projectShare.allowDownload,
      allowNotes: projectShare.allowNotes,
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

  // Get recipients for all shares
  const shareIds = shares.map((s) => s.id)
  let recipientsByShareId: Record<
    string,
    Array<{
      id: string
      email: string
      status: string
      invitedAt: Date
      firstViewedAt: Date | null
      lastViewedAt: Date | null
      viewCount: number
      user: { id: string; name: string; image: string | null } | null
    }>
  > = {}

  if (shareIds.length > 0) {
    const recipients = await db
      .select({
        id: projectShareRecipient.id,
        shareId: projectShareRecipient.shareId,
        email: projectShareRecipient.email,
        status: projectShareRecipient.status,
        invitedAt: projectShareRecipient.invitedAt,
        firstViewedAt: projectShareRecipient.firstViewedAt,
        lastViewedAt: projectShareRecipient.lastViewedAt,
        viewCount: projectShareRecipient.viewCount,
        user: {
          id: user.id,
          name: user.name,
          image: user.image
        }
      })
      .from(projectShareRecipient)
      .leftJoin(user, eq(projectShareRecipient.userId, user.id))
      .where(inArray(projectShareRecipient.shareId, shareIds))

    // Group recipients by shareId
    recipientsByShareId = recipients.reduce(
      (acc, r) => {
        if (!acc[r.shareId]) {
          acc[r.shareId] = []
        }
        acc[r.shareId]!.push({
          id: r.id,
          email: r.email,
          status: r.status,
          invitedAt: r.invitedAt,
          firstViewedAt: r.firstViewedAt,
          lastViewedAt: r.lastViewedAt,
          viewCount: r.viewCount,
          user: r.user?.id ? r.user : null
        })
        return acc
      },
      {} as typeof recipientsByShareId
    )
  }

  // Combine shares with their recipients
  return shares.map((share) => ({
    ...share,
    recipients: recipientsByShareId[share.id] || []
  }))
})
