import { z } from "zod"
import { sql, ilike, or, desc, asc } from "drizzle-orm"

const querySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "List Organizations",
    description: "Get paginated list of organizations for admin management",
    parameters: [
      {
        name: "search",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Search organizations by name or slug"
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
        description: "Number of organizations per page"
      },
      {
        name: "sortBy",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["createdAt", "name"], default: "createdAt" },
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
        description: "Paginated list of organizations",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                organizations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      slug: { type: "string" },
                      logo: { type: "string", nullable: true },
                      createdAt: { type: "string", format: "date-time" },
                      memberCount: { type: "number" }
                    },
                    required: ["id", "name", "slug", "createdAt", "memberCount"]
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
              required: ["organizations", "pagination"]
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
