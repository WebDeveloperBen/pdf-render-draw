import { z } from "zod"
import { and, desc, asc, eq, like, or, sql, inArray } from "drizzle-orm"

const querySchema = z.object({
  search: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "lastViewedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Projects"],
    summary: "List Projects",
    description: "Get paginated list of projects accessible to the authenticated user",
    parameters: [
      {
        name: "search",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Search projects by name or description"
      },
      {
        name: "sortBy",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["name", "createdAt", "updatedAt", "lastViewedAt"], default: "createdAt" },
        description: "Field to sort by"
      },
      {
        name: "sortOrder",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
        description: "Sort order"
      },
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        description: "Number of projects per page"
      },
      {
        name: "offset",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 0, default: 0 },
        description: "Number of projects to skip"
      }
    ],
    responses: {
      200: {
        description: "Paginated list of projects",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  description: { type: "string", nullable: true },
                  annotationCount: { type: "number" },
                  lastViewedAt: { type: "string", format: "date-time", nullable: true },
                  createdBy: { type: "string" },
                  organizationId: { type: "string", nullable: true },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                  creator: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      email: { type: "string" },
                      image: { type: "string", nullable: true }
                    },
                    required: ["id", "name", "email"]
                  },
                  organization: {
                    type: "object",
                    nullable: true,
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      slug: { type: "string" },
                      logo: { type: "string", nullable: true }
                    }
                  },
                  shares: { type: "array", items: { type: "object" } },
                  _count: {
                    type: "object",
                    properties: {
                      shares: { type: "number" },
                      files: { type: "number" }
                    },
                    required: ["shares", "files"]
                  }
                },
                required: [
                  "id",
                  "name",
                  "annotationCount",
                  "createdBy",
                  "createdAt",
                  "updatedAt",
                  "creator",
                  "shares",
                  "_count"
                ]
              }
            }
          }
        }
      },
      400: { description: "Bad request - no active organization" },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { orgId } = await requireActiveOrg(event)

  // Validate query params
  const query = await getValidatedQuery(event, querySchema.parse)

  const db = useDrizzle()

  // Build where conditions
  const conditions = []

  // Filter by active organization - all projects flow through organizations
  conditions.push(eq(project.organizationId, orgId))

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

  // Get file counts for each project
  const fileCounts =
    projectIds.length > 0
      ? await db
          .select({
            projectId: projectFile.projectId,
            count: sql<number>`count(*)::int`
          })
          .from(projectFile)
          .where(inArray(projectFile.projectId, projectIds))
          .groupBy(projectFile.projectId)
      : []

  const fileCountMap = new Map(fileCounts.map((fc) => [fc.projectId, fc.count]))

  // Combine results
  return projects.map((p) => ({
    ...p,
    shares: [],
    _count: {
      shares: shareCountMap.get(p.id) || 0,
      files: fileCountMap.get(p.id) || 0
    }
  }))
})
