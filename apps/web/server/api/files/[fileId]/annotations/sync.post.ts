import { z } from "zod"
import { eq, and, isNull, gt, or, inArray } from "drizzle-orm"
import { randomUUID } from "crypto"
import { buildConflictServerVersion, isAnnotationScopedToFile } from "#shared/utils/annotation-sync"
import { syncRequestSchema } from "#shared/schemas/annotations"
import { requireFeatureAccess } from "../../../../services/billing/billing.guards"

const paramsSchema = z.object({
  fileId: z.uuid({ message: "Invalid file ID" })
})

const bodySchema = syncRequestSchema

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Annotations"],
    summary: "Sync Annotations",
    description: "Batch sync annotations with conflict detection and resolution",
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
            type: "object"
          }
        }
      }
    },
    responses: {
      200: {
        description: "Sync completed",
        content: {
          "application/json": {
            schema: {
              type: "object"
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

interface SyncConflict {
  annotationId: string
  reason: "version_mismatch" | "deleted" | "validation_error"
  serverVersion: Record<string, unknown> | null
  message?: string
}

export default defineEventHandler(async (event) => {
  const { user: authUser, orgId } = await requireActiveOrg(event)

  // Require cloud sync feature access
  await requireFeatureAccess(event, "cloudSync")

  // Validate route params and body
  const { fileId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()
  const userId = authUser.id
  const syncId = randomUUID()
  const serverTime = new Date()

  // Check if file exists and user has access (via project -> organization)
  const [file] = await db
    .select({
      id: projectFile.id,
      projectId: projectFile.projectId
    })
    .from(projectFile)
    .innerJoin(project, eq(projectFile.projectId, project.id))
    .where(and(eq(projectFile.id, fileId), eq(project.organizationId, orgId)))

  if (!file) {
    throw createError({
      statusCode: 404,
      statusMessage: "File not found or access denied"
    })
  }

  const applied: string[] = []
  const conflicts: SyncConflict[] = []

  // Process each operation
  for (const operation of body.operations) {
    const { type, annotation: clientAnnotation, localVersion } = operation

    try {
      if (type === "create") {
        // Check if annotation already exists (idempotency)
        const [existing] = await db
          .select({ id: annotation.id, deletedAt: annotation.deletedAt })
          .from(annotation)
          .where(eq(annotation.id, clientAnnotation.id))

        if (existing) {
          if (existing.deletedAt) {
            // Was deleted, client is trying to recreate - conflict
            conflicts.push({
              annotationId: clientAnnotation.id,
              reason: "deleted",
              serverVersion: null,
              message: "Annotation was deleted by another client"
            })
          } else {
            // Already exists (duplicate create from retry)
            applied.push(clientAnnotation.id)
          }
          continue
        }

        // Extract annotation-specific data (everything except metadata)
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

        applied.push(clientAnnotation.id)
      } else if (type === "update") {
        // Check current server state
        const [existing] = await db
          .select({
            id: annotation.id,
            fileId: annotation.fileId,
            type: annotation.type,
            pageNum: annotation.pageNum,
            version: annotation.version,
            deletedAt: annotation.deletedAt,
            data: annotation.data
          })
          .from(annotation)
          .where(and(eq(annotation.id, clientAnnotation.id), eq(annotation.fileId, fileId)))

        if (!existing || !isAnnotationScopedToFile(existing, fileId)) {
          conflicts.push({
            annotationId: clientAnnotation.id,
            reason: "validation_error",
            serverVersion: null,
            message: "Annotation not found"
          })
          continue
        }

        if (existing.deletedAt) {
          conflicts.push({
            annotationId: clientAnnotation.id,
            reason: "deleted",
            serverVersion: null,
            message: "Annotation was deleted by another client"
          })
          continue
        }

        // Server-wins conflict resolution
        // If server version is higher, report conflict and send server version
        if (existing.version > localVersion) {
          conflicts.push({
            annotationId: clientAnnotation.id,
            reason: "version_mismatch",
            serverVersion: buildConflictServerVersion(existing) as Record<string, unknown>
          })
          continue
        }

        // Extract annotation-specific data
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

        applied.push(clientAnnotation.id)
      } else if (type === "delete") {
        // Soft delete
        const [existing] = await db
          .select({
            id: annotation.id,
            fileId: annotation.fileId,
            version: annotation.version,
            deletedAt: annotation.deletedAt
          })
          .from(annotation)
          .where(and(eq(annotation.id, clientAnnotation.id), eq(annotation.fileId, fileId)))

        if (!existing || !isAnnotationScopedToFile(existing, fileId)) {
          // Already doesn't exist - treat as success (idempotent)
          applied.push(clientAnnotation.id)
          continue
        }

        if (existing.deletedAt) {
          // Already deleted - success (idempotent)
          applied.push(clientAnnotation.id)
          continue
        }

        // Perform soft delete
        await db
          .update(annotation)
          .set({
            deletedAt: serverTime,
            modifiedBy: userId,
            updatedAt: serverTime,
            version: existing.version + 1
          })
          .where(eq(annotation.id, clientAnnotation.id))

        applied.push(clientAnnotation.id)
      }
    } catch (error) {
      console.error(`Sync operation failed for annotation ${clientAnnotation.id}:`, error)
      conflicts.push({
        annotationId: clientAnnotation.id,
        reason: "validation_error",
        serverVersion: null,
        message: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Fetch server updates (changes from other clients since lastSyncTime)
  let serverUpdates: Array<{
    id: string
    type: string
    pageNum: number
    version: number
    deletedAt: Date | null
    data: Record<string, unknown>
  }> = []

  if (body.lastSyncTime) {
    const conditions = [eq(annotation.fileId, fileId), gt(annotation.updatedAt, new Date(body.lastSyncTime))]

    // Exclude annotations we just processed
    const processedIds = body.operations.map((op) => op.annotation.id)

    serverUpdates = await db
      .select({
        id: annotation.id,
        type: annotation.type,
        pageNum: annotation.pageNum,
        version: annotation.version,
        deletedAt: annotation.deletedAt,
        data: annotation.data
      })
      .from(annotation)
      .where(and(...conditions))

    // Filter out annotations we just processed
    serverUpdates = serverUpdates.filter((ann) => !processedIds.includes(ann.id))
  }

  // Format server updates for response
  const formattedServerUpdates = serverUpdates.map((ann) => ({
    ...ann.data,
    id: ann.id,
    type: ann.type,
    pageNum: ann.pageNum,
    version: ann.version,
    deletedAt: ann.deletedAt?.toISOString() || null
  }))

  // Handle viewport state sync (upsert)
  let viewportStateResult: {
    scale: number
    rotation: number
    scrollLeft: number
    scrollTop: number
    currentPage: number
  } | null = null

  if (body.viewportState) {
    try {
      await db
        .insert(userFileState)
        .values({
          userId,
          fileId,
          viewportScale: body.viewportState.scale,
          viewportRotation: body.viewportState.rotation,
          viewportScrollLeft: body.viewportState.scrollLeft,
          viewportScrollTop: body.viewportState.scrollTop,
          viewportCurrentPage: body.viewportState.currentPage
        })
        .onConflictDoUpdate({
          target: [userFileState.userId, userFileState.fileId],
          set: {
            viewportScale: body.viewportState.scale,
            viewportRotation: body.viewportState.rotation,
            viewportScrollLeft: body.viewportState.scrollLeft,
            viewportScrollTop: body.viewportState.scrollTop,
            viewportCurrentPage: body.viewportState.currentPage,
            updatedAt: serverTime
          }
        })

      // Return the viewport state we just saved
      viewportStateResult = {
        scale: body.viewportState.scale,
        rotation: body.viewportState.rotation,
        scrollLeft: body.viewportState.scrollLeft,
        scrollTop: body.viewportState.scrollTop,
        currentPage: body.viewportState.currentPage
      }
    } catch (error) {
      console.error("Failed to sync viewport state:", error)
      // Non-fatal - continue with annotation sync result
    }
  } else {
    // Fetch current viewport state for this user
    const [existing] = await db
      .select({
        scale: userFileState.viewportScale,
        rotation: userFileState.viewportRotation,
        scrollLeft: userFileState.viewportScrollLeft,
        scrollTop: userFileState.viewportScrollTop,
        currentPage: userFileState.viewportCurrentPage
      })
      .from(userFileState)
      .where(and(eq(userFileState.userId, userId), eq(userFileState.fileId, fileId)))

    viewportStateResult = existing || null
  }

  return {
    success: conflicts.length === 0,
    applied,
    conflicts,
    serverUpdates: formattedServerUpdates,
    meta: {
      serverTime: serverTime.toISOString(),
      syncId
    },
    viewportState: viewportStateResult
  }
})
