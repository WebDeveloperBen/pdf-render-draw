import { z } from "zod"
import { eq, inArray } from "drizzle-orm"
import { auth } from "@auth"

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
                type: "object",
                properties: {
                  id: { type: "string" },
                  projectId: { type: "string" },
                  token: { type: "string" },
                  createdBy: { type: "string" },
                  name: { type: "string", nullable: true },
                  shareType: { type: "string", enum: ["public", "private"] },
                  message: { type: "string", nullable: true },
                  expiresAt: { type: "string", format: "date-time", nullable: true },
                  password: { type: "string", nullable: true },
                  allowDownload: { type: "boolean" },
                  allowNotes: { type: "boolean" },
                  viewCount: { type: "number" },
                  lastViewedAt: { type: "string", format: "date-time", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                  creator: {
                    type: "object",
                    nullable: true,
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      email: { type: "string" }
                    }
                  },
                  recipients: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                        status: { type: "string" },
                        invitedAt: { type: "string", format: "date-time" },
                        firstViewedAt: { type: "string", format: "date-time", nullable: true },
                        lastViewedAt: { type: "string", format: "date-time", nullable: true },
                        viewCount: { type: "number" },
                        user: {
                          type: "object",
                          nullable: true,
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            image: { type: "string", nullable: true }
                          }
                        }
                      },
                      required: ["id", "email", "status", "invitedAt", "viewCount"]
                    }
                  }
                },
                required: [
                  "id",
                  "projectId",
                  "token",
                  "createdBy",
                  "shareType",
                  "allowDownload",
                  "allowNotes",
                  "viewCount",
                  "createdAt",
                  "updatedAt",
                  "recipients"
                ]
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
