import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

/**
 * Get pending invitations for the current user
 * Returns invitations sent to the user's email that are still pending
 */

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["User"],
    summary: "List Invitations",
    description: "Get pending organization invitations for the authenticated user",
    responses: {
      200: {
        description: "List of pending invitations",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  role: { type: "string" },
                  status: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                  expiresAt: { type: "string", format: "date-time", nullable: true },
                  organizationId: { type: "string" },
                  organizationName: { type: "string" },
                  organizationSlug: { type: "string" },
                  inviterName: { type: "string" },
                  inviterEmail: { type: "string" }
                },
                required: [
                  "id",
                  "email",
                  "role",
                  "status",
                  "createdAt",
                  "organizationId",
                  "organizationName",
                  "organizationSlug",
                  "inviterName",
                  "inviterEmail"
                ]
              }
            }
          }
        }
      },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

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
