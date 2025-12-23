import Dexie, { type Table } from "dexie"
import { toRaw } from "vue"

/**
 * Sync status for an annotation
 */
export type SyncStatus = "synced" | "pending" | "failed"

/**
 * Stored annotation with sync metadata
 */
export interface StoredAnnotation {
  id: string
  fileId: string
  annotation: Annotation
  syncStatus: SyncStatus
  version: number
  lastModified: number // timestamp
  deletedAt?: number // timestamp for soft deletes
}

/**
 * Pending sync operation
 */
export interface PendingOperation {
  id: string // Auto-generated
  fileId: string
  annotationId: string
  type: "create" | "update" | "delete"
  annotation: Annotation
  localVersion: number
  timestamp: string
  retryCount: number
  createdAt: number
}

/**
 * Sync metadata per file
 */
export interface SyncMeta {
  fileId: string
  lastSyncTime: string | null
  lastServerTime: string | null
}

/**
 * Dexie database for annotation storage
 * Note: Viewport state is handled separately by useViewportStorage
 */
class AnnotationDB extends Dexie {
  annotations!: Table<StoredAnnotation, string>
  pendingOperations!: Table<PendingOperation, string>
  syncMeta!: Table<SyncMeta, string>

  constructor() {
    super("AnnotationDB")

    this.version(1).stores({
      annotations: "id, fileId, syncStatus, lastModified, deletedAt",
      pendingOperations: "id, fileId, annotationId, createdAt",
      syncMeta: "fileId"
    })
  }
}

// Singleton database instance
let db: AnnotationDB | null = null

function getDB(): AnnotationDB {
  if (!db) {
    db = new AnnotationDB()
  }
  return db
}

/**
 * Composable for IndexedDB annotation storage
 */
export function useAnnotationStorage() {
  const database = getDB()

  /**
   * Load all annotations for a file from local storage
   */
  async function loadFromLocal(fileId: string): Promise<StoredAnnotation[]> {
    return await database.annotations.where({ fileId }).toArray()
  }

  /**
   * Get a single annotation by ID
   */
  async function getAnnotation(annotationId: string): Promise<StoredAnnotation | undefined> {
    return await database.annotations.get(annotationId)
  }

  /**
   * Save an annotation to local storage and queue sync operation
   */
  async function saveToLocal(
    fileId: string,
    annotation: Annotation,
    isNew: boolean = false
  ): Promise<void> {
    const now = Date.now()

    // Get existing record to check version
    const existing = await database.annotations.get(annotation.id)
    const version = existing ? existing.version + 1 : 1

    // Convert to raw object to avoid Vue reactivity proxies that can't be cloned
    const rawAnnotation = JSON.parse(JSON.stringify(toRaw(annotation))) as Annotation

    // Save annotation
    await database.annotations.put({
      id: rawAnnotation.id,
      fileId,
      annotation: rawAnnotation,
      syncStatus: "pending",
      version,
      lastModified: now
    })

    // Queue sync operation
    await queueOperation(fileId, rawAnnotation, isNew ? "create" : "update", version)
  }

  /**
   * Delete an annotation (soft delete) and queue sync operation
   */
  async function deleteFromLocal(fileId: string, annotationId: string): Promise<void> {
    const existing = await database.annotations.get(annotationId)

    if (!existing) return

    const now = Date.now()
    const version = existing.version + 1

    // Mark as deleted (soft delete)
    await database.annotations.update(annotationId, {
      syncStatus: "pending",
      version,
      lastModified: now,
      deletedAt: now
    })

    // Queue delete operation
    await queueOperation(fileId, existing.annotation, "delete", version)
  }

  /**
   * Queue a sync operation
   */
  async function queueOperation(
    fileId: string,
    annotation: Annotation,
    type: "create" | "update" | "delete",
    localVersion: number
  ): Promise<void> {
    const operationId = `${annotation.id}-${Date.now()}`

    // Remove any existing operations for this annotation (superseded)
    await database.pendingOperations.where({ annotationId: annotation.id }).delete()

    // Ensure annotation is a plain object (may already be from saveToLocal)
    const rawAnnotation =
      typeof annotation === "object" && annotation !== null
        ? (JSON.parse(JSON.stringify(toRaw(annotation))) as Annotation)
        : annotation

    // Add new operation
    await database.pendingOperations.add({
      id: operationId,
      fileId,
      annotationId: rawAnnotation.id,
      type,
      annotation: rawAnnotation,
      localVersion,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      createdAt: Date.now()
    })
  }

  /**
   * Get all pending operations for a file
   */
  async function getPendingOperations(fileId: string): Promise<PendingOperation[]> {
    return await database.pendingOperations
      .where({ fileId })
      .sortBy("createdAt")
  }

  /**
   * Get count of pending operations for a file
   */
  async function getPendingCount(fileId: string): Promise<number> {
    return await database.pendingOperations.where({ fileId }).count()
  }

  /**
   * Mark operations as synced (remove from pending queue)
   */
  async function markSynced(annotationIds: string[]): Promise<void> {
    // Remove from pending operations
    await database.pendingOperations
      .where("annotationId")
      .anyOf(annotationIds)
      .delete()

    // Update sync status in annotations
    await database.annotations
      .where("id")
      .anyOf(annotationIds)
      .modify({ syncStatus: "synced" })
  }

  /**
   * Mark operations as failed (increment retry count)
   */
  async function markFailed(annotationIds: string[]): Promise<void> {
    await database.annotations
      .where("id")
      .anyOf(annotationIds)
      .modify({ syncStatus: "failed" })

    await database.pendingOperations
      .where("annotationId")
      .anyOf(annotationIds)
      .modify((op) => {
        op.retryCount++
      })
  }

  /**
   * Remove failed operations that exceeded max retries
   */
  async function removeExhaustedOperations(maxRetries: number = 5): Promise<string[]> {
    const exhausted = await database.pendingOperations
      .filter((op) => op.retryCount >= maxRetries)
      .toArray()

    const ids = exhausted.map((op) => op.annotationId)

    await database.pendingOperations
      .where("annotationId")
      .anyOf(ids)
      .delete()

    return ids
  }

  /**
   * Apply server updates to local storage
   */
  async function applyServerUpdates(
    fileId: string,
    updates: Array<{
      id: string
      type: string
      pageNum: number
      version: number
      deletedAt: string | null
      [key: string]: unknown
    }>
  ): Promise<void> {
    const now = Date.now()

    for (const update of updates) {
      const { id, type, pageNum, version, deletedAt, ...data } = update

      if (deletedAt) {
        // Server says it's deleted - remove from local storage
        await database.annotations.delete(id)
        await database.pendingOperations.where({ annotationId: id }).delete()
      } else {
        // Update or create annotation
        const annotation: Annotation = {
          id,
          type: type as Annotation["type"],
          pageNum,
          ...data
        } as Annotation

        await database.annotations.put({
          id,
          fileId,
          annotation,
          syncStatus: "synced",
          version,
          lastModified: now
        })
      }
    }
  }

  /**
   * Get sync metadata for a file
   */
  async function getSyncMeta(fileId: string): Promise<SyncMeta | undefined> {
    return await database.syncMeta.get(fileId)
  }

  /**
   * Update sync metadata
   */
  async function updateSyncMeta(
    fileId: string,
    lastSyncTime: string | null,
    lastServerTime: string | null
  ): Promise<void> {
    await database.syncMeta.put({
      fileId,
      lastSyncTime,
      lastServerTime
    })
  }

  /**
   * Clear all local data for a file
   */
  async function clearFileData(fileId: string): Promise<void> {
    await database.annotations.where({ fileId }).delete()
    await database.pendingOperations.where({ fileId }).delete()
    await database.syncMeta.delete(fileId)
  }

  /**
   * Bulk save annotations from server (initial load)
   */
  async function bulkSaveFromServer(
    fileId: string,
    annotations: Array<{
      id: string
      type: string
      pageNum: number
      version: number
      deletedAt: string | null
      [key: string]: unknown
    }>
  ): Promise<void> {
    const now = Date.now()

    const records: StoredAnnotation[] = annotations
      .filter((ann) => !ann.deletedAt)
      .map((ann) => {
        const { id, type, pageNum, version, deletedAt: _, ...data } = ann
        return {
          id,
          fileId,
          annotation: {
            id,
            type: type as Annotation["type"],
            pageNum,
            ...data
          } as Annotation,
          syncStatus: "synced" as SyncStatus,
          version,
          lastModified: now
        }
      })

    await database.annotations.bulkPut(records)
  }

  /**
   * Get all annotations not marked as deleted
   */
  async function getActiveAnnotations(fileId: string): Promise<Annotation[]> {
    const stored = await database.annotations
      .where({ fileId })
      .filter((a) => !a.deletedAt)
      .toArray()

    return stored.map((s) => s.annotation)
  }

  return {
    // Core CRUD
    loadFromLocal,
    getAnnotation,
    saveToLocal,
    deleteFromLocal,
    getActiveAnnotations,

    // Sync operations
    getPendingOperations,
    getPendingCount,
    markSynced,
    markFailed,
    removeExhaustedOperations,
    queueOperation,

    // Server sync
    applyServerUpdates,
    bulkSaveFromServer,

    // Metadata
    getSyncMeta,
    updateSyncMeta,
    clearFileData
  }
}
