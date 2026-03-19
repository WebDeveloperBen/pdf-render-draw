import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(__dirname, "../../../shared/db/migrations")

export interface StartedTestDatabase {
  connectionUri: string
  container: StartedPostgreSqlContainer
}

export interface TestEnvironmentOptions {
  baseUrl: string
  connectionUri: string
}

export async function startTestDatabase(): Promise<StartedTestDatabase> {
  console.log("\n🐳 Starting PostgreSQL container...")

  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test")
    .withPassword("test")
    .start()

  const connectionUri = container.getConnectionUri()
  console.log(`✅ Container started: ${connectionUri}`)

  console.log("📦 Running migrations...")
  const pool = new pg.Pool({ connectionString: connectionUri })
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder })
  await pool.end()
  console.log("✅ Migrations complete")

  return { connectionUri, container }
}

export function applyTestEnvironment({ baseUrl, connectionUri }: TestEnvironmentOptions) {
  const url = new URL(baseUrl)

  process.env.VITEST = "true"
  process.env.DATABASE_URL = connectionUri
  process.env.NUXT_DATABASE_URL = connectionUri
  process.env.BETTER_AUTH_SECRET = "test-integration-secret-must-be-at-least-32-chars"
  process.env.NUXT_BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET
  process.env.BETTER_AUTH_URL = baseUrl
  process.env.NUXT_PUBLIC_BETTER_AUTH_URL = baseUrl
  process.env.NUXT_STRIPE_SECRET_KEY = "sk_test_fake_key_for_integration_tests"
  process.env.NUXT_STRIPE_WEBHOOK_SECRET = "whsec_test_fake_secret_for_integration_tests"
  process.env.NUXT_RESEND_API_KEY = "re_test_fake_key_for_integration_tests"
  process.env.__TEST_DATABASE_URL__ = connectionUri
  process.env.HOST = url.hostname
  process.env.PORT = url.port || (url.protocol === "https:" ? "443" : "80")
}

export async function stopTestDatabase(container?: StartedPostgreSqlContainer) {
  console.log("\n🐳 Stopping PostgreSQL container...")
  await container?.stop()
  console.log("✅ Container stopped")
}
