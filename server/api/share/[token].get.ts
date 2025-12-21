import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

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
      .where(
        and(eq(projectShareRecipient.shareId, share.id), eq(projectShareRecipient.email, session.user.email))
      )

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
    const query = getQuery(event)
    const providedPassword = query.password as string | undefined

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
