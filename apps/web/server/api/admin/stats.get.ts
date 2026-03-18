import { sql } from "drizzle-orm"

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "Get Platform Stats",
    description: "Get platform-wide statistics for admin dashboard",
    responses: {
      200: {
        description: "Platform statistics",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                users: {
                  type: "object",
                  properties: {
                    total: { type: "number" },
                    recentSignups: { type: "number" },
                    banned: { type: "number" }
                  },
                  required: ["total", "recentSignups", "banned"]
                },
                organizations: {
                  type: "object",
                  properties: {
                    total: { type: "number" }
                  },
                  required: ["total"]
                },
                projects: {
                  type: "object",
                  properties: {
                    total: { type: "number" }
                  },
                  required: ["total"]
                },
                sessions: {
                  type: "object",
                  properties: {
                    active: { type: "number" }
                  },
                  required: ["active"]
                }
              },
              required: ["users", "organizations", "projects", "sessions"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const db = useDrizzle()

  // Get counts from various tables
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(user)

  const [orgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(organization)

  const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(project)

  const [activeSessionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(session)
    .where(sql`${session.expiresAt} > now()`)

  // Get recent signups (last 7 days)
  const [recentSignups] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(sql`${user.createdAt} > now() - interval '7 days'`)

  // Get banned users count
  const [bannedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(sql`${user.banned} = true`)

  return {
    users: {
      total: userCount?.count ?? 0,
      recentSignups: recentSignups?.count ?? 0,
      banned: bannedCount?.count ?? 0
    },
    organizations: {
      total: orgCount?.count ?? 0
    },
    projects: {
      total: projectCount?.count ?? 0
    },
    sessions: {
      active: activeSessionCount?.count ?? 0
    }
  }
})
