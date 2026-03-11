import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

/**
 * Lightweight sync endpoint for navigator.sendBeacon()
 * Used for beforeunload saves - fire and forget, no response expected
 */

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" })
})

const syncOperationSchema = z.object({
  type: z.enum(["create", "update", "delete"]),
  annotation: z
    .object({
      id: z.string().uuid(),
      type: z.enum(["measure", "area", "perimeter", "line", "fill", "text", "count"]),
      pageNum: z.number().int().min(1),
      rotation: z.number().default(0)
    })
    .passthrough(),
  localVersion: z.number().int().min(0),
  timestamp: z.string().datetime()
})

const bodySchema = z.object({
  clientTime: z.string().datetime(),
  operations: z.array(syncOperationSchema).max(50) // Smaller limit for beacon
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Annotations"],
    summary: "Sync Annotations (Beacon)",
    description: "Lightweight sync endpoint for beforeunload saves. Fire-and-forget, best effort.",
    parameters: [
      {
        name: "fileId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "File ID (UUID)"
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              clientTime: { type: "string", format: "date-time" },
              operations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["create", "update", "delete"] },
                    annotation: { type: "object" },
                    localVersion: { type: "number" },
                    timestamp: { type: "string", format: "date-time" }
                  },
                  required: ["type", "annotation", "localVersion", "timestamp"]
                },
                maxItems: 50
              }
            },
            required: ["clientTime", "operations"]
          }
        }
      }
    },
    responses: {
      204: { description: "Accepted for processing" },
      401: { description: "Unauthorized" },
      404: { description: "File not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  // Validate route params and body
  const { fileId } = await getValidatedRouterParams(event, paramsSchema.parse)

  let body
  try {
    body = await readValidatedBody(event, bodySchema.parse)
  } catch {
    // For beacon, silently fail on invalid body
    setResponseStatus(event, 204)
    return null
  }

  // Get active organization
  const activeOrgId = session.session.activeOrganizationId

  if (!activeOrgId) {
    setResponseStatus(event, 204)
    return null
  }

  const db = useDrizzle()
  const userId = session.user.id
  const serverTime = new Date()

  // Check if file exists and user has access
  const [file] = await db
    .select({
      id: projectFile.id,
      projectId: projectFile.projectId
    })
    .from(projectFile)
    .innerJoin(project, eq(projectFile.projectId, project.id))
    .where(and(eq(projectFile.id, fileId), eq(project.organizationId, activeOrgId)))

  if (!file) {
    setResponseStatus(event, 204)
    return null
  }

  // Process operations (best effort, no error handling for individual ops)
  for (const operation of body.operations) {
    const { type, annotation: clientAnnotation } = operation

    try {
      if (type === "create") {
        // Check if exists first
        const [existing] = await db
          .select({ id: annotation.id })
          .from(annotation)
          .where(eq(annotation.id, clientAnnotation.id))

        if (!existing) {
          const { id, type: annType, pageNum, ...annotationData } = clientAnnotation

          await db.insert(annotation).values({
            id: clientAnnotation.id,
            fileId,
            projectId: file.projectId,
            type: annType,
            pageNum,
            data: annotationData as Record<string, unknown>,
            createdBy: userId,
            modifiedBy: userId,
            version: 1
          })
        }
      } else if (type === "update") {
        const [existing] = await db
          .select({ id: annotation.id, version: annotation.version, deletedAt: annotation.deletedAt })
          .from(annotation)
          .where(eq(annotation.id, clientAnnotation.id))

        if (existing && !existing.deletedAt) {
          const { id, type: annType, pageNum, ...annotationData } = clientAnnotation

          await db
            .update(annotation)
            .set({
              type: annType,
              pageNum,
              data: annotationData as Record<string, unknown>,
              modifiedBy: userId,
              updatedAt: serverTime,
              version: existing.version + 1
            })
            .where(eq(annotation.id, clientAnnotation.id))
        }
      } else if (type === "delete") {
        const [existing] = await db
          .select({ id: annotation.id, deletedAt: annotation.deletedAt })
          .from(annotation)
          .where(eq(annotation.id, clientAnnotation.id))

        if (existing && !existing.deletedAt) {
          await db
            .update(annotation)
            .set({
              deletedAt: serverTime,
              modifiedBy: userId,
              updatedAt: serverTime
            })
            .where(eq(annotation.id, clientAnnotation.id))
        }
      }
    } catch {
      // Silently continue on errors - this is best effort
    }
  }

  setResponseStatus(event, 204)
  return null
})
