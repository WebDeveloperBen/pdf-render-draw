import type { drizzle } from "drizzle-orm/node-postgres"
import type * as schema from "../../../shared/db/schema"
import { sql } from "drizzle-orm"

type TestDb = ReturnType<typeof drizzle<typeof schema>>

export function getTestDb(): TestDb {
  const db = globalThis.__testDb__
  if (!db) throw new Error("Test DB not initialized. Is setup.ts running?")
  return db as TestDb
}

const TABLES_TO_TRUNCATE = [
  "billing_sync_log",
  "billing_activity",
  "stripe_plan",
  "user_file_state",
  "annotation",
  "project_share_recipient",
  "project_share",
  "project_file",
  "project",
  "platform_admin",
  "admin_audit_log",
  "api_key",
  "team_member",
  "team",
  "invitation",
  "member",
  "subscription",
  "organization",
  "session",
  "account",
  "verification",
  "user"
]

export async function truncateAll(db?: TestDb) {
  const d = db ?? getTestDb()
  for (const table of TABLES_TO_TRUNCATE) {
    await d.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`))
  }
}
