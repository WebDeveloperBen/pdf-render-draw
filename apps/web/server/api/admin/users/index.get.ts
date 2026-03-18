import { z } from "zod"
import { sql, ilike, or, desc, asc } from "drizzle-orm"

const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "List Users",
    description: "Get paginated list of users for admin management",
    parameters: [
      {
        name: "search",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Search users by name or email"
      },
      {
        name: "page",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, default: 1 },
        description: "Page number for pagination"
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        description: "Number of users per page"
      },
      {
        name: "sortBy",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["createdAt", "name", "email"], default: "createdAt" },
        description: "Field to sort by"
      },
      {
        name: "sortOrder",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
        description: "Sort order"
      }
    ],
    responses: {
      200: {
        description: "Paginated list of users",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                users: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      email: { type: "string" },
                      emailVerified: { type: "boolean", nullable: true },
                      image: { type: "string", nullable: true },
                      role: { type: "string" },
                      banned: { type: "boolean" },
                      banReason: { type: "string", nullable: true },
                      banExpires: { type: "string", format: "date-time", nullable: true },
                      createdAt: { type: "string", format: "date-time" },
                      updatedAt: { type: "string", format: "date-time" }
                    },
                    required: ["id", "name", "email", "role", "banned", "createdAt", "updatedAt"]
                  }
                },
                pagination: {
                  type: "object",
                  properties: {
                    page: { type: "number" },
                    limit: { type: "number" },
                    total: { type: "number" },
                    totalPages: { type: "number" }
                  },
                  required: ["page", "limit", "total", "totalPages"]
                }
              },
              required: ["users", "pagination"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = useDrizzle()

  const offset = (query.page - 1) * query.limit

  // Build search condition
  const searchCondition = query.search
    ? or(ilike(user.name, `%${query.search}%`), ilike(user.email, `%${query.search}%`))
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
