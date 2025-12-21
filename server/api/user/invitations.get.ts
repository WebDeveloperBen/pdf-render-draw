import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

/**
 * Get pending invitations for the current user
 * Returns invitations sent to the user's email that are still pending
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()

  const pendingInvitations = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      inviterName: user.name,
      inviterEmail: user.email
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(user, eq(invitation.inviterId, user.id))
    .where(and(eq(invitation.email, session.user.email), eq(invitation.status, "pending")))
    .orderBy(invitation.createdAt)

  return pendingInvitations
})
