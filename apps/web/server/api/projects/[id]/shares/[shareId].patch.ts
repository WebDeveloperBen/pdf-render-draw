import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"
import { hashSharePassword } from "@shared/utils/project-share"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" }),
  shareId: z.uuid({ message: "Invalid share ID" })
})

const bodySchema = z.object({
  name: z.string().max(100).nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  password: z.string().min(4, "Password must be at least 4 characters").nullable().optional(),
  allowDownload: z.boolean().optional(),
  allowNotes: z.boolean().optional()
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Projects", "Shares"],
    summary: "Update Share",
    description: "Update share settings",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID"
      },
      {
        name: "shareId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Share ID"
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
                nullable: true,
                description: "Share name"
              },
              message: {
                type: "string",
                nullable: true,
                description: "Share message"
              },
              expiresAt: {
                type: "string",
                format: "date-time",
                nullable: true,
                description: "Expiration date"
              },
              password: {
                type: "string",
                nullable: true,
                description: "Password for public shares"
              },
              allowDownload: {
                type: "boolean",
                description: "Whether to allow downloads"
              },
              allowNotes: {
                type: "boolean",
                description: "Whether to allow notes"
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Share updated successfully",
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
                "updatedAt"
              ]
            }
          }
        }
      },
      400: { description: "Bad request - validation error" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - access denied" },
      404: { description: "Project or share not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  // Check permission to share projects
  await requirePermission(event, { project: ["share"] })

  const { id: projectId, shareId } = await getValidatedRouterParams(event, paramsSchema.parse)
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

  // Check if project exists and belongs to active organization
  const [projectData] = await db.select().from(project).where(eq(project.id, projectId))

  if (!projectData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  if (projectData.organizationId !== activeOrgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
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

  // Only share creator can update shares
  if (share.createdBy !== session.user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only share creator can update shares."
    })
  }

  // Build update data
  const updateData: Partial<typeof projectShare.$inferInsert> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.message !== undefined) updateData.message = body.message
  if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt
  if (body.password !== undefined) updateData.password = hashSharePassword(body.password)
  if (body.allowDownload !== undefined) updateData.allowDownload = body.allowDownload
  if (body.allowNotes !== undefined) updateData.allowNotes = body.allowNotes

  // Update share
  await db.update(projectShare).set(updateData).where(eq(projectShare.id, shareId))

  // Fetch updated share with creator info
  const [updatedShare] = await db
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

  return updatedShare
})
