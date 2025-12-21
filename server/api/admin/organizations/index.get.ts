import { z } from "zod"
import { sql, ilike, or, desc, asc } from "drizzle-orm"

const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
})

export default defineEventHandler(async (event) => {
  // Require platform admin access
  await requirePlatformAdmin(event)

  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDrizzle()

  const offset = (query.page - 1) * query.limit

  // Build search condition
  const searchCondition = query.search
    ? or(ilike(organization.name, `%${query.search}%`), ilike(organization.slug, `%${query.search}%`))
    : undefined

  // Build sort
  const sortColumn = {
    createdAt: organization.createdAt,
    name: organization.name
  }[query.sortBy]

  const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn)

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organization)
    .where(searchCondition)
  const total = countResult?.count ?? 0

  // Get organizations with member count
  const organizations = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      createdAt: organization.createdAt,
      memberCount: sql<number>`(
        SELECT COUNT(*)::int FROM member WHERE member.organization_id = ${organization.id}
      )`
    })
    .from(organization)
    .where(searchCondition)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(offset)

  return {
    organizations,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    }
  }
})
