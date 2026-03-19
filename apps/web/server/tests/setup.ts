import { setup } from "@nuxt/test-utils/e2e"
import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import * as schema from "../../shared/db/schema"
import { beforeAll, beforeEach, afterAll } from "vitest"

type TestDb = ReturnType<typeof drizzle<typeof schema>>
const __dirname = dirname(fileURLToPath(import.meta.url))

declare global {
  // eslint-disable-next-line no-var
  var __testDb__: TestDb | undefined
  // eslint-disable-next-line no-var
  var __testPool__: pg.Pool | undefined
}

// Boot the Nuxt server ONCE for all test files.
// setup() registers beforeAll/afterAll hooks internally.
//
// Nitro docs: development always uses `nitro_dev`, while production builds use
// deployment-specific presets. We run integration tests against Nuxt's dev
// server so the suite exercises the real app code and request pipeline without
// coupling tests to Cloudflare's production bundle output.
setup({
  rootDir: resolve(__dirname, "../.."),
  server: true,
  browser: false,
  dev: true,
  setupTimeout: 240_000
})

// Tables in reverse FK dependency order for safe truncation
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

beforeAll(async () => {
  const connectionString = process.env.__TEST_DATABASE_URL__ || process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("No test database URL found. Is global-setup running?")
  }

  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool, { schema })

  globalThis.__testPool__ = pool
  globalThis.__testDb__ = db
})

beforeEach(async () => {
  const db = globalThis.__testDb__
  if (!db) throw new Error("Test DB not initialized")

  // Truncate all tables in reverse FK order
  for (const table of TABLES_TO_TRUNCATE) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`))
  }
})

afterAll(async () => {
  await globalThis.__testPool__?.end()
  globalThis.__testDb__ = undefined
  globalThis.__testPool__ = undefined
})
