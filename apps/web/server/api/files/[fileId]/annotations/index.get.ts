import { z } from "zod"
import { eq, and, isNull, gt, or } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" })
})

const querySchema = z.object({
  since: z.string().datetime().optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((v) => v === "true")
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Annotations"],
    summary: "Get Annotations",
    description: "Get all annotations for a file",
    parameters: [
      {
        name: "fileId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "File ID (UUID)"
      },
      {
        name: "since",
        in: "query",
        required: false,
        schema: { type: "string", format: "date-time" },
        description: "Only return annotations modified after this timestamp (for incremental sync)"
      },
      {
        name: "includeDeleted",
        in: "query",
        required: false,
        schema: { type: "boolean" },
        description: "Include soft-deleted annotations (for sync reconciliation)"
      }
    ],
    responses: {
      200: {
        description: "Annotations for the file",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                annotations: {
                  type: "array",
                  items: {
                    type: "object",
                    description: "Annotation data (type varies by annotation type)"
                  }
                },
                meta: {
                  type: "object",
                  properties: {
                    count: { type: "number" },
                    lastModified: { type: "string", format: "date-time", nullable: true },
                    serverTime: { type: "string", format: "date-time" }
                  },
                  required: ["count", "serverTime"]
                },
                viewportState: {
                  type: "object",
                  nullable: true,
                  description: "User-specific viewport state",
                  properties: {
                    scale: { type: "number" },
                    rotation: { type: "number" },
                    scrollLeft: { type: "number" },
                    scrollTop: { type: "number" },
                    currentPage: { type: "number" }
                  }
                }
              },
              required: ["annotations", "meta"]
            }
          }
        }
      },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - access denied" },
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

  // Validate route params and query
  const { fileId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const { since, includeDeleted } = await getValidatedQuery(event, querySchema.parse)

  // Get active organization
  const activeOrgId = session.session.activeOrganizationId

  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  const db = useDrizzle()

  // Check if file exists and user has access (via project -> organization)
  const [file] = await db
    .select({
      id: projectFile.id,
      projectId: projectFile.projectId
    })
    .from(projectFile)
    .innerJoin(project, eq(projectFile.projectId, project.id))
    .where(and(eq(projectFile.id, fileId), eq(project.organizationId, activeOrgId)))

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: "File not found or access denied"
    })
  }

  // Build query conditions
  const conditions = [eq(annotation.fileId, fileId)]

  // Filter by since timestamp if provided
  if (since) {
    conditions.push(gt(annotation.updatedAt, new Date(since)))
  }

  // Include or exclude deleted
  if (!includeDeleted) {
    conditions.push(isNull(annotation.deletedAt))
  }

  // Get annotations
  const annotations = await db
    .select({
      id: annotation.id,
      fileId: annotation.fileId,
      type: annotation.type,
      pageNum: annotation.pageNum,
      data: annotation.data,
      version: annotation.version,
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt,
      deletedAt: annotation.deletedAt
    })
    .from(annotation)
    .where(and(...conditions))
    .orderBy(annotation.createdAt)

  // Get last modified timestamp
  const lastModified =
    annotations.length > 0
      ? annotations.reduce((latest, ann) => {
          const annTime = new Date(ann.updatedAt).getTime()
          return annTime > latest ? annTime : latest
        }, 0)
      : null

  // Get user-specific viewport state
  const userId = session.user.id
  const [viewportStateData] = await db
    .select({
      scale: userFileState.viewportScale,
      rotation: userFileState.viewportRotation,
      scrollLeft: userFileState.viewportScrollLeft,
      scrollTop: userFileState.viewportScrollTop,
      currentPage: userFileState.viewportCurrentPage
    })
    .from(userFileState)
    .where(and(eq(userFileState.userId, userId), eq(userFileState.fileId, fileId)))

  // Return annotations with their data field extracted
  return {
    annotations: annotations.map((ann) => ({
      ...ann.data,
      id: ann.id,
      type: ann.type,
      pageNum: ann.pageNum,
      version: ann.version,
      deletedAt: ann.deletedAt
    })),
    meta: {
      count: annotations.length,
      lastModified: lastModified ? new Date(lastModified).toISOString() : null,
      serverTime: new Date().toISOString()
    },
    viewportState: viewportStateData || null
  }
})
