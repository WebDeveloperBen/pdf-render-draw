import { eq, and } from "drizzle-orm"
import { auth } from "@auth"
import { z } from "zod"

// Query schema for password-protected shares
const querySchema = z.object({
  password: z.string().optional()
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Share"],
    summary: "Get Shared Project",
    description: "Get shared project by token",
    parameters: [
      {
        name: "token",
        in: "path",
        required: true,
        schema: { type: "string" }
      },
      {
        name: "password",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Password for password-protected shares"
      }
    ],
    responses: {
      200: {
        description: "Shared project data",
        content: {
          "application/json": {
            schema: {
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
                annotationCount: { type: "number" },
                lastViewedAt: { type: "string", format: "date-time", nullable: true },
                createdBy: { type: "string" },
                organizationId: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                creator: {
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
                    slug: { type: "string" },
                    logo: { type: "string", nullable: true }
                  }
                },
                share: {
                  type: "object",
                  properties: {
                    shareType: { type: "string", enum: ["public", "private"] },
                    allowDownload: { type: "boolean" },
                    allowNotes: { type: "boolean" },
                    canAddNotes: { type: "boolean" },
                    viewCount: { type: "number" }
                  }
                }
              },
              required: [
                "id",
                "name",
                "pdfUrl",
                "pageCount",
                "annotationCount",
                "createdBy",
                "organizationId",
                "createdAt",
                "updatedAt",
                "share"
              ]
            }
          }
        }
      },
      400: { description: "Password required or invalid password" },
      403: { description: "Private share requires authentication" },
      404: { description: "Share or project not found" },
      410: { description: "Share link has expired" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const db = useDrizzle()
  const token = getRouterParam(event, "token")

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Share token is required"
    })
  }

  // Get share by token
  const [share] = await db.select().from(projectShare).where(eq(projectShare.token, token))

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
      statusMessage: "This share link has expired"
    })
  }

  // Handle private shares - require authentication and valid recipient
  if (share.shareType === "private") {
    const session = await auth.api.getSession({ headers: event.headers })

    if (!session) {
      throw createError({
        statusCode: 403,
        statusMessage: "This is a private share. Please check your email for the access link.",
        data: { requiresAuth: true }
      })
    }

    // Check if user is a valid recipient for this share
    const [recipient] = await db
      .select()
      .from(projectShareRecipient)
      .where(and(eq(projectShareRecipient.shareId, share.id), eq(projectShareRecipient.email, session.user.email)))

    if (!recipient) {
      throw createError({
        statusCode: 403,
        statusMessage: "You do not have access to this share"
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
  }

  // Check password if required (for public shares only - private shares use magic link)
  if (share.shareType === "public" && share.password) {
    const query = querySchema.parse(getQuery(event))
    const providedPassword = query.password

    if (!providedPassword) {
      throw createError({
        statusCode: 400,
        statusMessage: "Password required for this share"
      })
    }

    // Hash provided password and compare
    const crypto = await import("crypto")
    const hashedProvided = crypto.createHash("sha256").update(providedPassword).digest("hex")

    if (hashedProvided !== share.password) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid password"
      })
    }
  }

  // Increment view count and update last viewed
  await db
    .update(projectShare)
    .set({
      viewCount: share.viewCount + 1,
      lastViewedAt: new Date()
    })
    .where(eq(projectShare.id, share.id))

  // Get project data
  const [projectData] = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      pdfUrl: project.pdfUrl,
      pdfFileName: project.pdfFileName,
      pdfFileSize: project.pdfFileSize,
      thumbnailUrl: project.thumbnailUrl,
      pageCount: project.pageCount,
      annotationCount: project.annotationCount,
      lastViewedAt: project.lastViewedAt,
      createdBy: project.createdBy,
      organizationId: project.organizationId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo
      }
    })
    .from(project)
    .leftJoin(user, eq(project.createdBy, user.id))
    .leftJoin(organization, eq(project.organizationId, organization.id))
    .where(eq(project.id, share.projectId))

  if (!projectData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // For notes, user must be authenticated (private share) and notes must be allowed
  const session = await auth.api.getSession({ headers: event.headers })
  const canAddNotes = share.allowNotes && share.shareType === "private" && !!session

  return {
    ...projectData,
    share: {
      shareType: share.shareType,
      allowDownload: share.allowDownload,
      allowNotes: share.allowNotes,
      canAddNotes, // Computed: whether this user can actually add notes
      viewCount: share.viewCount + 1
    }
  }
})
