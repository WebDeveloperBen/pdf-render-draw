import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { z } from "zod"
import { annotationsResponseSchema, syncRequestSchema, syncResponseSchema } from "../shared/schemas/annotations"
import { publicPlansResponseSchema } from "../shared/schemas/billing"
import {
  projectFileWithUploaderSchema,
  projectListItemSchema,
  projectShareWithRelationsSchema,
  projectWithRelationsSchema
} from "../shared/schemas/projects"
import { userProfileResponseSchema } from "../shared/schemas/user"

const OPEN_API_URL = process.env.OPEN_API_URL ?? "http://localhost:3000/_docs/openapi.json"
const OUTPUT_PATH = resolve(".generated/openapi.orval.json")

type OpenApiDocument = {
  paths?: Record<string, unknown>
  [key: string]: unknown
}

type JsonObject = Record<string, unknown>

function toOpenApiSchema(schema: z.ZodTypeAny): JsonObject {
  const jsonSchema = z.toJSONSchema(schema) as JsonObject
  return stripJsonSchemaMeta(jsonSchema)
}

function stripJsonSchemaMeta(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripJsonSchemaMeta)
  }

  if (!value || typeof value !== "object") {
    return value
  }

  const entries = Object.entries(value as JsonObject)
    .filter(([key]) => key !== "$schema")
    .map(([key, child]) => [key, stripJsonSchemaMeta(child)])

  return Object.fromEntries(entries)
}

function setResponseSchema(
  document: OpenApiDocument,
  path: string,
  method: string,
  status: string,
  schema: JsonObject
) {
  const operation = document.paths?.[path] as JsonObject | undefined
  const methodObject = operation?.[method] as JsonObject | undefined
  const responses = methodObject?.responses as JsonObject | undefined
  const response = responses?.[status] as JsonObject | undefined
  const content = response?.content as JsonObject | undefined
  const jsonContent = (content?.["application/json"] as JsonObject | undefined) ?? {}

  if (!response) return

  response.content = {
    ...(content ?? {}),
    "application/json": {
      ...jsonContent,
      schema
    }
  }
}

function setRequestBodySchema(document: OpenApiDocument, path: string, method: string, schema: JsonObject) {
  const operation = document.paths?.[path] as JsonObject | undefined
  const methodObject = operation?.[method] as JsonObject | undefined
  const requestBody = methodObject?.requestBody as JsonObject | undefined
  const content = requestBody?.content as JsonObject | undefined
  const jsonContent = (content?.["application/json"] as JsonObject | undefined) ?? {}

  if (!requestBody) return

  requestBody.content = {
    ...(content ?? {}),
    "application/json": {
      ...jsonContent,
      schema
    }
  }
}

function enrichSchemas(document: OpenApiDocument) {
  setResponseSchema(
    document,
    "/api/files/{fileId}/annotations",
    "get",
    "200",
    toOpenApiSchema(annotationsResponseSchema)
  )
  setRequestBodySchema(document, "/api/files/{fileId}/annotations/sync", "post", toOpenApiSchema(syncRequestSchema))
  setResponseSchema(
    document,
    "/api/files/{fileId}/annotations/sync",
    "post",
    "200",
    toOpenApiSchema(syncResponseSchema)
  )
  setResponseSchema(document, "/api/projects/{id}", "get", "200", toOpenApiSchema(projectWithRelationsSchema))
  setResponseSchema(
    document,
    "/api/projects/{id}/files",
    "get",
    "200",
    toOpenApiSchema(z.array(projectFileWithUploaderSchema))
  )
  setResponseSchema(
    document,
    "/api/projects/{id}/shares",
    "get",
    "200",
    toOpenApiSchema(z.array(projectShareWithRelationsSchema))
  )
  setResponseSchema(document, "/api/projects", "get", "200", toOpenApiSchema(z.array(projectListItemSchema)))
  setResponseSchema(document, "/api/projects", "post", "201", toOpenApiSchema(projectWithRelationsSchema))
  setResponseSchema(document, "/api/plans", "get", "200", toOpenApiSchema(publicPlansResponseSchema))
  setResponseSchema(document, "/api/user/profile", "get", "200", toOpenApiSchema(userProfileResponseSchema))
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
  enrichSchemas(document)
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
