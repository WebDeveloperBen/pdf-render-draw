import { z } from "zod"
import { eq, sql } from "drizzle-orm"

const paramsSchema = z.object({
  id: z.string().min(1, "User ID is required")
})

export default defineEventHandler(async (event) => {
  // Require platform admin access
  await requirePlatformAdmin(event)

  const { id: userId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDrizzle()

  // Get user with their organizations
  const [userData] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
    .from(user)
    .where(eq(user.id, userId))

  if (!userData) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found"
    })
  }

  // Get user's organization memberships
  const memberships = await db
    .select({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo
      }
    })
    .from(member)
    .leftJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))

  // Get user's project count
  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(eq(project.createdBy, userId))

  // Get active sessions count
  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(session)
    .where(sql`${session.userId} = ${userId} AND ${session.expiresAt} > now()`)

  return {
    ...userData,
    memberships,
    _count: {
      projects: projectCount?.count ?? 0,
      activeSessions: sessionCount?.count ?? 0
    }
  }
})
