import { z } from "zod"
import { eq, and, or, like, gte, lte, desc, count, inArray, type SQL } from "drizzle-orm"
import * as schema from "@shared/db/schema"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actionType: z.string().optional(),
  adminId: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
})

defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "List Audit Log",
    description: "Get paginated, filterable audit log entries for all platform actions",
    responses: {
      200: {
        description: "Audit log entries with pagination",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                entries: { type: "array", items: { type: "object" } },
                pagination: {
                  type: "object",
                  properties: {
                    page: { type: "number" },
                    limit: { type: "number" },
                    total: { type: "number" },
                    totalPages: { type: "number" }
                  }
                },
                actionTypes: {
                  type: "array",
                  items: { type: "string" },
                  description: "All distinct action types for filter dropdown"
                }
              }
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)

  const query = await getValidatedQuery(event, querySchema.parse)
  const { page, limit } = query
  const offset = (page - 1) * limit

  const db = useDrizzle()

  // Build where conditions
  const conditions: SQL[] = []

  if (query.actionType) {
    conditions.push(eq(schema.adminAuditLog.actionType, query.actionType))
  }

  if (query.adminId) {
    conditions.push(eq(schema.adminAuditLog.adminId, query.adminId))
  }

  if (query.dateFrom) {
    conditions.push(gte(schema.adminAuditLog.createdAt, new Date(query.dateFrom)))
  }

  if (query.dateTo) {
    // Add 1 day to include the entire "to" date
    const toDate = new Date(query.dateTo)
    toDate.setDate(toDate.getDate() + 1)
    conditions.push(lte(schema.adminAuditLog.createdAt, toDate))
  }

  if (query.search) {
    const searchTerm = `%${query.search}%`
    conditions.push(
      or(like(schema.adminAuditLog.actionType, searchTerm), like(schema.adminAuditLog.metadata, searchTerm))!
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const [countResult] = await db.select({ count: count() }).from(schema.adminAuditLog).where(whereClause)

  const total = countResult?.count ?? 0

  // Get entries with admin and target user info
  const entries = await db
    .select({
      id: schema.adminAuditLog.id,
      actionType: schema.adminAuditLog.actionType,
      targetUserId: schema.adminAuditLog.targetUserId,
      targetOrgId: schema.adminAuditLog.targetOrgId,
      metadata: schema.adminAuditLog.metadata,
      ipAddress: schema.adminAuditLog.ipAddress,
      userAgent: schema.adminAuditLog.userAgent,
      createdAt: schema.adminAuditLog.createdAt,
      adminId: schema.adminAuditLog.adminId,
      adminName: schema.user.name,
      adminEmail: schema.user.email
    })
    .from(schema.adminAuditLog)
    .leftJoin(schema.user, eq(schema.adminAuditLog.adminId, schema.user.id))
    .where(whereClause)
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset)

  // Collect target user IDs and org IDs to batch-resolve names
  const targetUserIds = [...new Set(entries.filter((e) => e.targetUserId).map((e) => e.targetUserId!))]
  const targetOrgIds = [...new Set(entries.filter((e) => e.targetOrgId).map((e) => e.targetOrgId!))]

  // Batch fetch target users
  const targetUsersMap = new Map<string, { name: string | null; email: string }>()
  if (targetUserIds.length > 0) {
    const targetUsers = await db
      .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, targetUserIds))
    for (const u of targetUsers) {
      targetUsersMap.set(u.id, { name: u.name, email: u.email })
    }
  }

  // Batch fetch target orgs
  const targetOrgsMap = new Map<string, { name: string; slug: string }>()
  if (targetOrgIds.length > 0) {
    const targetOrgs = await db
      .select({ id: schema.organization.id, name: schema.organization.name, slug: schema.organization.slug })
      .from(schema.organization)
      .where(inArray(schema.organization.id, targetOrgIds))
    for (const o of targetOrgs) {
      targetOrgsMap.set(o.id, { name: o.name, slug: o.slug })
    }
  }

  // Get distinct action types for filter dropdown
  const actionTypesResult = await db
    .selectDistinct({ actionType: schema.adminAuditLog.actionType })
    .from(schema.adminAuditLog)
    .orderBy(schema.adminAuditLog.actionType)

  const enrichedEntries = entries.map((entry) => ({
    id: entry.id,
    actionType: entry.actionType,
    createdAt: entry.createdAt,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
    admin: {
      id: entry.adminId,
      name: entry.adminName,
      email: entry.adminEmail
    },
    targetUser: entry.targetUserId
      ? {
          id: entry.targetUserId,
          ...targetUsersMap.get(entry.targetUserId)
        }
      : null,
    targetOrg: entry.targetOrgId
      ? {
          id: entry.targetOrgId,
          ...targetOrgsMap.get(entry.targetOrgId)
        }
      : null
  }))

  return {
    entries: enrichedEntries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    actionTypes: actionTypesResult.map((r) => r.actionType)
  }
})
