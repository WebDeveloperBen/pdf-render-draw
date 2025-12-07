import { eq, sql, desc, or } from "drizzle-orm"
import { auth } from "@auth"

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()

  // Get user's organizations
  const userOrganizations = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, session.user.id))

  const orgIds = userOrganizations.map((m) => m.organizationId)

  // Build condition for projects accessible to user
  const projectAccessCondition =
    orgIds.length > 0
      ? or(eq(project.createdBy, session.user.id), sql`${project.organizationId} IN ${orgIds}`)
      : eq(project.createdBy, session.user.id)

  // Count total projects
  const [totalProjectsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(projectAccessCondition)

  // Count personal projects (no organization)
  const [personalProjectsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(sql`${project.createdBy} = ${session.user.id} AND ${project.organizationId} IS NULL`)

  // Count team projects (with organization)
  const [teamProjectsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(sql`${projectAccessCondition} AND ${project.organizationId} IS NOT NULL`)

  // Count organizations
  const [totalOrganizationsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.userId, session.user.id))

  // Count active shares (for user's projects)
  const [totalSharesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectShare)
    .innerJoin(project, eq(projectShare.projectId, project.id))
    .where(eq(project.createdBy, session.user.id))

  // Get recent activity (last 10 projects created or updated)
  const recentProjects = await db
    .select({
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      createdBy: project.createdBy,
      userName: user.name,
      organizationName: organization.name
    })
    .from(project)
    .leftJoin(user, eq(project.createdBy, user.id))
    .leftJoin(organization, eq(project.organizationId, organization.id))
    .where(projectAccessCondition)
    .orderBy(desc(project.updatedAt))
    .limit(10)

  // Transform recent projects into activity items
  const recentActivity = recentProjects.map((p) => ({
    id: p.id,
    type: "project_updated" as const,
    projectId: p.id,
    projectName: p.name,
    organizationId: p.organizationId,
    organizationName: p.organizationName,
    createdAt: p.updatedAt,
    userId: p.createdBy,
    userName: p.userName
  }))

  return {
    totalProjects: totalProjectsResult?.count ?? 0,
    personalProjects: personalProjectsResult?.count ?? 0,
    teamProjects: teamProjectsResult?.count ?? 0,
    totalOrganizations: totalOrganizationsResult?.count ?? 0,
    totalShares: totalSharesResult?.count ?? 0,
    recentActivity
  }
})
