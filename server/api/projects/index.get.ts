import { z } from "zod"
import { and, desc, asc, eq, like, or, sql, inArray } from "drizzle-orm"
import { auth } from "@auth"

const querySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "lastViewedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
})

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  // Validate query params
  const query = await getValidatedQuery(event, querySchema.parse)

  // Get active organization from session
  // Every user has a home org created on signup, so this should always be set
  const activeOrgId = session.session.activeOrganizationId

  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  const db = useDrizzle()

  // Build where conditions
  const conditions = []

  // Filter by active organization - all projects flow through organizations
  conditions.push(eq(project.organizationId, activeOrgId))

  // Search filter
  if (query.search) {
    conditions.push(or(like(project.name, `%${query.search}%`), like(project.description, `%${query.search}%`)))
  }

  // Determine sort column and order
  const sortColumnMap = {
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastViewedAt: project.lastViewedAt
  } as const

  const sortColumn = sortColumnMap[query.sortBy]
  const orderFn = query.sortOrder === "asc" ? asc : desc

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
    .limit(query.limit)
    .offset(query.offset)

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
          .where(inArray(projectShare.projectId, projectIds))
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
