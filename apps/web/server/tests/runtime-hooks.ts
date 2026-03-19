import pg from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { beforeAll, beforeEach, afterAll } from "vitest"
import * as schema from "../../shared/db/schema"
import { truncateAll } from "./helpers/db"

type TestDb = ReturnType<typeof drizzle<typeof schema>>
const testBaseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000"

declare global {
  // eslint-disable-next-line no-var
  var __testDb__: TestDb | undefined
  // eslint-disable-next-line no-var
  var __testPool__: pg.Pool | undefined
}

let hooksRegistered = false

export function registerServerTestHooks() {
  if (hooksRegistered) {
    return
  }

  hooksRegistered = true

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
    if (!db) {
      throw new Error("Test DB not initialized")
    }

    await truncateAll(db)
    await fetch(`${testBaseUrl}/api/_test/state`, {
      method: "DELETE"
    })
  })

  afterAll(async () => {
    await globalThis.__testPool__?.end()
    globalThis.__testDb__ = undefined
    globalThis.__testPool__ = undefined
  })
}
