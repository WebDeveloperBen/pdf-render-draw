import { z } from "zod"
import { sql, ilike, or, desc, asc } from "drizzle-orm"

const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
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
    ? or(
        ilike(user.name, `%${query.search}%`),
        ilike(user.email, `%${query.search}%`)
      )
    : undefined

  // Build sort
  const sortColumn = {
    createdAt: user.createdAt,
    name: user.name,
    email: user.email
  }[query.sortBy]

  const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn)

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(searchCondition)
  const total = countResult?.count ?? 0

  // Get users
  const users = await db
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
    .from(user)
    .where(searchCondition)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(offset)

  return {
    users,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    }
  }
})
