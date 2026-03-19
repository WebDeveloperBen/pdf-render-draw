import { z } from "zod"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@auth"
import { requirePlan } from "../../../../services/billing/billing.guards"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

const bodySchema = z
  .object({
    name: z.string().max(100).optional(),
    shareType: z.enum(["public", "private"]).default("public"),
    message: z.string().max(500).optional(),
    recipients: z.array(z.string().email()).optional(),
    password: z.string().min(4, "Password must be at least 4 characters").nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    allowDownload: z.boolean().default(true),
    allowNotes: z.boolean().default(false)
  })
  .refine(
    (data) => {
      // Private shares must have at least one recipient
      if (data.shareType === "private") {
        return data.recipients && data.recipients.length > 0
      }
      return true
    },
    { message: "Private shares require at least one recipient", path: ["recipients"] }
  )

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Project Shares"],
    summary: "Create Share",
    description: "Create a new share for a project",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID (UUID)"
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Share name"
              },
              shareType: {
                type: "string",
                enum: ["public", "private"],
                default: "public",
                description: "Type of share"
              },
              message: {
                type: "string",
                description: "Share message"
              },
              recipients: {
                type: "array",
                items: { type: "string", format: "email" },
                description: "Email addresses for private shares"
              },
              password: {
                type: "string",
                nullable: true,
                description: "Password for public shares"
              },
              expiresAt: {
                type: "string",
                format: "date-time",
                nullable: true,
                description: "Expiration date"
              },
              allowDownload: {
                type: "boolean",
                default: true,
                description: "Whether to allow downloads"
              },
              allowNotes: {
                type: "boolean",
                default: false,
                description: "Whether to allow notes"
              }
            },
            required: []
          }
        }
      }
    },
    responses: {
      201: {
        description: "Share created successfully",
        content: {
          "application/json": {
            schema: {
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
                shareUrl: { type: "string" },
                recipients: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      email: { type: "string" },
                      status: { type: "string" },
                      invitedAt: { type: "string", format: "date-time" }
                    }
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
                "shareUrl",
                "recipients"
              ]
            }
          }
        }
      },
      400: { description: "Bad request - validation error or no active organization" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - insufficient permissions or access denied" },
      404: { description: "Project not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { user: authUser, orgId } = await requireActiveOrg(event)

  // Require at least starter plan for sharing
  await requirePlan(event, "starter")

  // Check permission to share projects
  await requirePermission(event, { project: ["share"] })

  // Validate route params and body
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

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
      createdBy: authUser.id,
      name: body.name ?? null,
      shareType: body.shareType,
      message: body.message ?? null,
      expiresAt: body.expiresAt ?? null,
      password: hashedPassword,
      allowDownload: body.allowDownload,
      allowNotes: body.allowNotes,
      viewCount: 0,
      lastViewedAt: null
    })
    .returning()

  // For private shares, create recipient records and send magic links
  const createdRecipients: Array<{
    id: string
    email: string
    status: string
  }> = []

  if (body.shareType === "private" && body.recipients && body.recipients.length > 0) {
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

    for (const email of body.recipients) {
      const recipientId = randomUUID()

      // Create recipient record
      await db.insert(projectShareRecipient).values({
        id: recipientId,
        shareId,
        email,
        status: "pending",
        invitedAt: new Date(),
        viewCount: 0
      })

      createdRecipients.push({
        id: recipientId,
        email,
        status: "pending"
      })

      // Send magic link via better-auth
      // The callbackURL includes share context so we can associate the user on login
      try {
        await auth.api.signInMagicLink({
          body: {
            email,
            callbackURL: `${baseUrl}/guest?share=${shareId}`
          },
          headers: event.headers
        })
        console.log(`[Share Invite] Magic link sent to ${email} for share ${shareId}`)
      } catch (error) {
        console.error(`[Share Invite] Failed to send magic link to ${email}:`, error)
        // Continue with other recipients even if one fails
      }
    }
  }

  // Fetch share with creator info
  const [shareWithCreator] = await db
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
    .where(eq(projectShare.id, shareId))

  // Generate shareable URL
  const baseUrl = process.env.BASE_URL || "http://localhost:3000"
  const shareUrl = `${baseUrl}/share/${token}`

  setResponseStatus(event, 201)
  return {
    ...shareWithCreator,
    shareUrl,
    recipients: createdRecipients
  }
})
