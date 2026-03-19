import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"

const OPEN_API_URL = "http://localhost:3000/_docs/openapi.json"
const OUTPUT_PATH = resolve(".generated/openapi.orval.json")

type OpenApiDocument = {
  paths?: Record<string, unknown>
  [key: string]: unknown
}

function shouldKeepPath(path: string) {
  if (!path.startsWith("/api/")) return false
  if (path.startsWith("/api/auth/")) return false
  return true
}

async function main() {
  const response = await fetch(OPEN_API_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec from ${OPEN_API_URL}: ${response.status} ${response.statusText}`)
  }

  const document = (await response.json()) as OpenApiDocument
  const paths = document.paths ?? {}

  const filteredPaths = Object.fromEntries(Object.entries(paths).filter(([path]) => shouldKeepPath(path)))

  await mkdir(resolve(".generated"), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify({ ...document, paths: filteredPaths }, null, 2)}\n`, "utf8")

  const result = spawnSync("pnpm", ["exec", "orval"], { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
