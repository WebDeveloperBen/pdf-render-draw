import { and, desc, asc, eq, like, or, sql } from "drizzle-orm"
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
  const query = getQuery(event)

  const organizationFilter = query.organizationId as string | undefined
  const searchTerm = query.search as string | undefined
  const sortBy = (query.sortBy as string) || "createdAt"
  const sortOrder = (query.sortOrder as string) || "desc"
  const limit = Number(query.limit) || 50
  const offset = Number(query.offset) || 0

  // Build where conditions
  const conditions = []

  // User can see:
  // 1. Projects they created
  // 2. Projects in organizations they're a member of
  const userOrganizations = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, session.user.id))

  const orgIds = userOrganizations.map((m) => m.organizationId)

  conditions.push(
    or(
      eq(project.createdBy, session.user.id),
      orgIds.length > 0 ? sql`${project.organizationId} IN ${orgIds}` : sql`false`
    )
  )

  // Organization filter
  if (organizationFilter) {
    if (organizationFilter === "personal") {
      conditions.push(sql`${project.organizationId} IS NULL`)
    } else {
      conditions.push(eq(project.organizationId, organizationFilter))
    }
  }

  // Search filter
  if (searchTerm) {
    conditions.push(or(like(project.name, `%${searchTerm}%`), like(project.description, `%${searchTerm}%`)))
  }

  // Determine sort column and order
  const sortColumn =
    sortBy === "name"
      ? project.name
      : sortBy === "updatedAt"
        ? project.updatedAt
        : sortBy === "lastViewedAt"
          ? project.lastViewedAt
          : project.createdAt

  const orderFn = sortOrder === "asc" ? asc : desc

  // Query projects with relations
  const projects = await db
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
    .where(and(...conditions))
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset)

  // Get share counts for each project
  const projectIds = projects.map((p) => p.id)

  const shareCounts =
    projectIds.length > 0
      ? await db
          .select({
            projectId: projectShare.projectId,
            count: sql<number>`count(*)::int`
          })
          .from(projectShare)
          .where(sql`${projectShare.projectId} IN ${projectIds}`)
          .groupBy(projectShare.projectId)
      : []

  const shareCountMap = new Map(shareCounts.map((sc) => [sc.projectId, sc.count]))

  // Combine results
  return projects.map((p) => ({
    ...p,
    shares: [],
    _count: {
      shares: shareCountMap.get(p.id) || 0
    }
  }))
})
