import { z } from "zod"
import { eq, sql } from "drizzle-orm"

const paramsSchema = z.object({
  id: z.string().min(1, "Organization ID is required")
})

export default defineEventHandler(async (event) => {
  // Require platform admin access
  await requirePlatformAdmin(event)

  const { id: orgId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDrizzle()

  // Get organization
  const [orgData] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      metadata: organization.metadata,
      createdAt: organization.createdAt
    })
    .from(organization)
    .where(eq(organization.id, orgId))

  if (!orgData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Organization not found"
    })
  }

  // Get members with user info
  const members = await db
    .select({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        banned: user.banned
      }
    })
    .from(member)
    .leftJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, orgId))

  // Get project count
  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(eq(project.organizationId, orgId))

  // Get invitation count
  const [invitationCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invitation)
    .where(eq(invitation.organizationId, orgId))

  return {
    ...orgData,
    members,
    _count: {
      members: members.length,
      projects: projectCount?.count ?? 0,
      pendingInvitations: invitationCount?.count ?? 0
    }
  }
})
