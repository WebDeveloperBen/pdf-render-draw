import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { applyTestEnvironment, startTestDatabase, stopTestDatabase } from "./harness/environment"
import { buildCloudflareBundle, startWranglerPreview } from "./harness/wrangler-preview"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, "../..")
const prodSmokeBaseUrl = "http://127.0.0.1:3000"

let container: StartedPostgreSqlContainer | undefined
let previewServer: Awaited<ReturnType<typeof startWranglerPreview>> | undefined

export async function setup() {
  const startedDatabase = await startTestDatabase()
  container = startedDatabase.container

  // We keep `VITEST=true` here so the built worker can still talk to the
  // Testcontainers Postgres instance. Without a Neon-compatible datasource we
  // cannot exercise the exact production DB transport locally, so this suite is
  // scoped to build/runtime parity rather than database-driver parity.
  applyTestEnvironment({
    baseUrl: prodSmokeBaseUrl,
    connectionUri: startedDatabase.connectionUri
  })

  await buildCloudflareBundle(webRoot)
  previewServer = await startWranglerPreview({
    baseUrl: prodSmokeBaseUrl,
    cwd: webRoot
  })
}

export async function teardown() {
  await previewServer?.stop()
  await stopTestDatabase(container)
}
