import Dexie, { type Table } from "dexie"

export type ViewportSyncStatus = "synced" | "pending" | "failed"

/**
 * Viewport state stored in IndexedDB
 * Keyed by fileId (user is implicit from browser storage)
 */
export interface StoredViewportState {
  fileId: string
  scale: number
  rotation: number
  scrollLeft: number
  scrollTop: number
  currentPage: number
  syncStatus: ViewportSyncStatus
  lastModified: number
}

/**
 * Viewport state to save/load
 */
export interface ViewportState {
  scale: number
  rotation: number
  scrollLeft: number
  scrollTop: number
  currentPage: number
}

/**
 * Dexie database for viewport storage
 * Separate from annotation DB to keep concerns clean
 */
class ViewportDB extends Dexie {
  viewportState!: Table<StoredViewportState, string>

  constructor() {
    super("ViewportDB")

    this.version(1).stores({
      viewportState: "fileId, syncStatus, lastModified"
    })
  }
}

// Singleton database instance
let db: ViewportDB | null = null

function getDB(): ViewportDB {
  if (!db) {
    db = new ViewportDB()
  }
  return db
}

/**
 * Composable for IndexedDB viewport state storage
 * Follows same local-first pattern as annotation storage
 */
export function useViewportStorage() {
  const database = getDB()

  /**
   * Get viewport state for a file from local storage
   */
  async function getViewportState(fileId: string): Promise<StoredViewportState | undefined> {
    return await database.viewportState.get(fileId)
  }

  /**
   * Save viewport state to local storage
   * Marks as pending for sync
   */
  async function saveViewportState(fileId: string, state: ViewportState): Promise<void> {
    const now = Date.now()

    await database.viewportState.put({
      fileId,
      ...state,
      syncStatus: "pending",
      lastModified: now
    })
  }

  /**
   * Mark viewport state as synced
   */
  async function markSynced(fileId: string): Promise<void> {
    await database.viewportState.update(fileId, {
      syncStatus: "synced"
    })
  }

  /**
   * Mark viewport state as failed
   */
  async function markFailed(fileId: string): Promise<void> {
    await database.viewportState.update(fileId, {
      syncStatus: "failed"
    })
  }

  /**
   * Get all pending viewport states that need sync
   */
  async function getPendingViewportStates(): Promise<StoredViewportState[]> {
    return await database.viewportState.where({ syncStatus: "pending" }).toArray()
  }

  /**
   * Check if a file has pending viewport state
   */
  async function hasPendingState(fileId: string): Promise<boolean> {
    const state = await database.viewportState.get(fileId)
    return state?.syncStatus === "pending"
  }

  /**
   * Apply server state to local storage (for initial load)
   */
  async function applyServerState(fileId: string, state: ViewportState): Promise<void> {
    const now = Date.now()

    await database.viewportState.put({
      fileId,
      ...state,
      syncStatus: "synced",
      lastModified: now
    })
  }

  /**
   * Clear viewport state for a file
   */
  async function clearFileState(fileId: string): Promise<void> {
    await database.viewportState.delete(fileId)
  }

  /**
   * Get default viewport state
   */
  function getDefaultState(): ViewportState {
    return {
      scale: 1,
      rotation: 0,
      scrollLeft: 0,
      scrollTop: 0,
      currentPage: 1
    }
  }

  return {
    getViewportState,
    saveViewportState,
    markSynced,
    markFailed,
    getPendingViewportStates,
    hasPendingState,
    applyServerState,
    clearFileState,
    getDefaultState
  }
}
