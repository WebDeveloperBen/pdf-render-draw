import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  shareId: z.string().uuid({ message: "Invalid share ID" })
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Guest"],
    summary: "Get Share",
    description: "Get detailed information about a specific share invitation",
    parameters: [
      {
        name: "shareId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Share ID (UUID)"
      }
    ],
    responses: {
      200: {
        description: "Detailed share information",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                shareId: { type: "string" },
                email: { type: "string" },
                status: { type: "string" },
                invitedAt: { type: "string", format: "date-time" },
                firstViewedAt: { type: "string", format: "date-time", nullable: true },
                lastViewedAt: { type: "string", format: "date-time", nullable: true },
                viewCount: { type: "number" },
                share: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    token: { type: "string" },
                    name: { type: "string", nullable: true },
                    message: { type: "string", nullable: true },
                    allowDownload: { type: "boolean" },
                    allowNotes: { type: "boolean" },
                    expiresAt: { type: "string", format: "date-time", nullable: true },
                    createdAt: { type: "string", format: "date-time" }
                  },
                  required: ["id", "token", "allowDownload", "allowNotes", "createdAt"]
                },
                project: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string", nullable: true },
                    pdfUrl: { type: "string" },
                    pdfFileName: { type: "string", nullable: true },
                    pdfFileSize: { type: "number", nullable: true },
                    thumbnailUrl: { type: "string", nullable: true },
                    pageCount: { type: "number" },
                    annotationCount: { type: "number" }
                  },
                  required: ["id", "name", "pdfUrl", "pageCount", "annotationCount"]
                },
                sharedBy: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    image: { type: "string", nullable: true }
                  }
                },
                organization: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    logo: { type: "string", nullable: true }
                  }
                },
                recipient: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    shareId: { type: "string" },
                    email: { type: "string" },
                    status: { type: "string" },
                    invitedAt: { type: "string", format: "date-time" },
                    firstViewedAt: { type: "string", format: "date-time", nullable: true },
                    lastViewedAt: { type: "string", format: "date-time", nullable: true },
                    viewCount: { type: "number" }
                  },
                  required: ["id", "shareId", "email", "status", "invitedAt", "viewCount"]
                },
                canAddNotes: { type: "boolean" }
              },
              required: [
                "id",
                "shareId",
                "email",
                "status",
                "invitedAt",
                "viewCount",
                "share",
                "project",
                "recipient",
                "canAddNotes"
              ]
            }
          }
        }
      },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - user does not have access to this share" },
      404: { description: "Share not found" },
      410: { description: "Share has expired" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require authenticated session
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const { shareId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDrizzle()

  // Get the share recipient record for this user
  const [recipient] = await db
    .select({
      id: projectShareRecipient.id,
      shareId: projectShareRecipient.shareId,
      email: projectShareRecipient.email,
      status: projectShareRecipient.status,
      invitedAt: projectShareRecipient.invitedAt,
      firstViewedAt: projectShareRecipient.firstViewedAt,
      lastViewedAt: projectShareRecipient.lastViewedAt,
      viewCount: projectShareRecipient.viewCount
    })
    .from(projectShareRecipient)
    .where(and(eq(projectShareRecipient.shareId, shareId), eq(projectShareRecipient.email, session.user.email)))

  if (!recipient) {
    throw createError({
      statusCode: 403,
      statusMessage: "You do not have access to this share"
    })
  }

  // Get the share with project details
  const [share] = await db
    .select({
      id: projectShare.id,
      token: projectShare.token,
      name: projectShare.name,
      message: projectShare.message,
      allowDownload: projectShare.allowDownload,
      allowNotes: projectShare.allowNotes,
      expiresAt: projectShare.expiresAt,
      createdAt: projectShare.createdAt,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        pdfUrl: project.pdfUrl,
        pdfFileName: project.pdfFileName,
        pdfFileSize: project.pdfFileSize,
        thumbnailUrl: project.thumbnailUrl,
        pageCount: project.pageCount,
        annotationCount: project.annotationCount
      },
      sharedBy: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      },
      organization: {
        id: organization.id,
        name: organization.name,
        logo: organization.logo
      }
    })
    .from(projectShare)
    .innerJoin(project, eq(projectShare.projectId, project.id))
    .leftJoin(user, eq(projectShare.createdBy, user.id))
    .leftJoin(organization, eq(project.organizationId, organization.id))
    .where(eq(projectShare.id, shareId))

  if (!share) {
    throw createError({
      statusCode: 404,
      statusMessage: "Share not found"
    })
  }

  // Check if share has expired
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    throw createError({
      statusCode: 410,
      statusMessage: "This share has expired"
    })
  }

  // Update recipient tracking
  const now = new Date()
  await db
    .update(projectShareRecipient)
    .set({
      status: "viewed",
      firstViewedAt: recipient.firstViewedAt ?? now,
      lastViewedAt: now,
      viewCount: recipient.viewCount + 1,
      userId: session.user.id
    })
    .where(eq(projectShareRecipient.id, recipient.id))

  return {
    ...share,
    recipient: {
      ...recipient,
      viewCount: recipient.viewCount + 1
    },
    canAddNotes: share.allowNotes // Guest can add notes if allowed on share
  }
})
