import { eq } from "drizzle-orm"
import { auth } from "@auth"

export default defineEventHandler(async (event) => {
  // Require authenticated session
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()

  // Get all share recipients for this user's email
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
      share: {
        id: projectShare.id,
        token: projectShare.token,
        name: projectShare.name,
        message: projectShare.message,
        allowDownload: projectShare.allowDownload,
        allowNotes: projectShare.allowNotes,
        expiresAt: projectShare.expiresAt,
        createdAt: projectShare.createdAt
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        thumbnailUrl: project.thumbnailUrl,
        pdfFileName: project.pdfFileName,
        pageCount: project.pageCount
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
    .from(projectShareRecipient)
    .innerJoin(projectShare, eq(projectShareRecipient.shareId, projectShare.id))
    .innerJoin(project, eq(projectShare.projectId, project.id))
    .leftJoin(user, eq(projectShare.createdBy, user.id))
    .leftJoin(organization, eq(project.organizationId, organization.id))
    .where(eq(projectShareRecipient.email, session.user.email))

  // Filter out expired shares
  const now = new Date()
  const activeShares = recipients.filter((r) => {
    if (r.share.expiresAt && new Date(r.share.expiresAt) < now) {
      return false
    }
    return true
  })

  return activeShares
})
