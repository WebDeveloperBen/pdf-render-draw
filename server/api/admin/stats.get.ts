import { sql } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  // Require platform admin access
  await requirePlatformAdmin(event)

  const db = useDrizzle()

  // Get counts from various tables
  const [userCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(user)

  const [orgCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organization)

  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)

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
