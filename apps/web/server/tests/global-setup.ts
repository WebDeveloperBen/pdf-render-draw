import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { applyTestEnvironment, startTestDatabase, stopTestDatabase } from "./harness/environment"

let container: StartedPostgreSqlContainer

export async function setup() {
  const startedDatabase = await startTestDatabase()
  container = startedDatabase.container

  applyTestEnvironment({
    baseUrl: "http://localhost:3000",
    connectionUri: startedDatabase.connectionUri
  })
}

export async function teardown() {
  await stopTestDatabase(container)
}
