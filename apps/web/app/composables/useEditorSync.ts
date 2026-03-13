import { useAnnotationStorage } from "@/composables/useAnnotationStorage"
import { useViewportStorage, type ViewportState } from "@/composables/useViewportStorage"
import { useOnline } from "@vueuse/core"

export type SyncState = "idle" | "syncing" | "error" | "offline"

export interface EditorSyncOptions {
  /** File ID to sync */
  fileId: Ref<string | null>
  /** Annotation store instance - used to intercept actions and sync changes */
  annotationStore: ReturnType<typeof useAnnotationStore>
  /** Callback when annotations are loaded from server */
  onAnnotationsLoaded?: (annotations: Annotation[]) => void
  /** Callback when viewport state is loaded from server */
  onViewportLoaded?: (viewport: ViewportState) => void
}

/**
 * Composable for syncing editor state (annotations + viewport) with server
 *
 * Provides:
 * - Local-first IndexedDB storage
 * - Debounced server sync (2s debounce, 10s max wait)
 * - Background sync interval (30s)
 * - Before unload / visibility change sync
 * - Online/offline handling
 */
export function useEditorSync(options: EditorSyncOptions) {
  const { fileId, annotationStore, onAnnotationsLoaded, onViewportLoaded } = options

  // Storage composables
  const storage = useAnnotationStorage()
  const viewportStorage = useViewportStorage()

  // Sync state
  const syncState = ref<SyncState>("idle")
  const lastSyncTime = ref<string | null>(null)
  const syncError = ref<string | null>(null)
  const pendingCount = ref(0)
  const isInitialized = ref(false)

  // Viewport state to sync
  const pendingViewportState = ref<ViewportState | null>(null)
  const currentViewportState = ref<ViewportState | null>(null)

  // Sync configuration
  const DEBOUNCE_MS = 2000
  const MAX_WAIT_MS = 10000
  const BACKGROUND_INTERVAL_MS = 30000

  // Internal sync state
  let syncTimeout: ReturnType<typeof setTimeout> | null = null
  let maxWaitTimeout: ReturnType<typeof setTimeout> | null = null
  let backgroundInterval: ReturnType<typeof setInterval> | null = null
  let isSyncing = false

  const isOnline = useOnline()

  // Computed
  const hasPendingChanges = computed(() => pendingCount.value > 0 || pendingViewportState.value !== null)

  /**
   * Perform sync with server
   */
  async function performSync(isBeacon: boolean = false): Promise<boolean> {
    const currentFileId = fileId.value
    if (!currentFileId || isSyncing) return false

    const operations = await storage.getPendingOperations(currentFileId)
    const hasViewportToSync = pendingViewportState.value !== null

    if (operations.length === 0 && !hasViewportToSync) {
      syncState.value = "idle"
      return true
    }

    if (!isOnline.value) {
      syncState.value = "offline"
      return false
    }

    isSyncing = true
    syncState.value = "syncing"
    syncError.value = null

    try {
      const meta = await storage.getSyncMeta(currentFileId)

      const formattedOps = operations.map((op) => ({
        type: op.type,
        annotation: op.annotation,
        localVersion: op.localVersion,
        timestamp: op.timestamp
      }))

      const viewportStateToSync = pendingViewportState.value

      const endpoint = isBeacon
        ? `/api/files/${currentFileId}/annotations/sync-beacon`
        : `/api/files/${currentFileId}/annotations/sync`

      if (isBeacon) {
        const blob = new Blob(
          [
            JSON.stringify({
              clientTime: new Date().toISOString(),
              operations: formattedOps,
              viewportState: viewportStateToSync || undefined
            })
          ],
          { type: "application/json" }
        )
        navigator.sendBeacon(endpoint, blob)
        pendingViewportState.value = null
        return true
      }

      const response = await $fetch(endpoint, {
        method: "POST",
        body: {
          clientTime: new Date().toISOString(),
          lastSyncTime: meta?.lastSyncTime || undefined,
          operations: formattedOps,
          viewportState: viewportStateToSync || undefined
        }
      })

      const {
        applied,
        conflicts,
        serverUpdates,
        meta: responseMeta,
        viewportState: returnedViewportState
      } = response as {
        applied: string[]
        conflicts: Array<{
          annotationId: string
          reason: string
          serverVersion: Record<string, unknown> | null
        }>
        serverUpdates: Array<{
          id: string
          type: string
          pageNum: number
          version: number
          deletedAt: string | null
          [key: string]: unknown
        }>
        meta: { serverTime: string; syncId: string }
        viewportState: ViewportState | null
      }

      // Handle viewport state
      if (viewportStateToSync) {
        pendingViewportState.value = null
        await viewportStorage.applyServerState(currentFileId, viewportStateToSync)
      }

      if (returnedViewportState) {
        currentViewportState.value = returnedViewportState
      }

      // Handle annotation sync results
      if (applied.length > 0) {
        await storage.markSynced(applied)
      }

      for (const conflict of conflicts) {
        if (conflict.serverVersion) {
          const sv = conflict.serverVersion as {
            id: string
            type: string
            pageNum: number
            version: number
            deletedAt: string | null
            [key: string]: unknown
          }
          await storage.applyServerUpdates(currentFileId, [sv])
          const { id, type, pageNum, version: _v, deletedAt: _d, ...data } = sv
          const ann = { id, type, pageNum, ...data } as Annotation
          annotationStore.updateAnnotationFromServer(ann)
        }
        await storage.markSynced([conflict.annotationId])
      }

      if (serverUpdates.length > 0) {
        await storage.applyServerUpdates(currentFileId, serverUpdates)
        for (const update of serverUpdates) {
          if (update.deletedAt) {
            annotationStore.removeAnnotationFromServer(update.id)
          } else {
            const { id, type, pageNum, version: _v, deletedAt: _d, ...data } = update
            const ann = { id, type, pageNum, ...data } as Annotation
            annotationStore.updateAnnotationFromServer(ann)
          }
        }
      }

      await storage.updateSyncMeta(currentFileId, responseMeta.serverTime, responseMeta.serverTime)
      lastSyncTime.value = responseMeta.serverTime
      pendingCount.value = await storage.getPendingCount(currentFileId)
      syncState.value = "idle"

      return true
    } catch (error) {
      console.error("Sync failed:", error)
      syncError.value = error instanceof Error ? error.message : "Sync failed"
      syncState.value = "error"
      return false
    } finally {
      isSyncing = false
    }
  }

  /**
   * Schedule a debounced sync
   */
  function scheduleSync(delay?: number): void {
    if (syncTimeout) clearTimeout(syncTimeout)
    syncTimeout = setTimeout(() => performSync(), delay ?? DEBOUNCE_MS)
  }

  /**
   * Trigger sync with debounce and max wait
   */
  function triggerSync(): void {
    if (!fileId.value) return
    scheduleSync()
    if (!maxWaitTimeout) {
      maxWaitTimeout = setTimeout(() => {
        maxWaitTimeout = null
        performSync()
      }, MAX_WAIT_MS)
    }
  }

  /**
   * Force immediate sync (for Ctrl+S)
   */
  async function forceSync(): Promise<boolean> {
    if (syncTimeout) clearTimeout(syncTimeout)
    if (maxWaitTimeout) clearTimeout(maxWaitTimeout)
    syncTimeout = null
    maxWaitTimeout = null
    return await performSync()
  }

  /**
   * Initialize sync for a file
   * Loads annotations and viewport from local storage, syncs with server
   */
  async function initializeForFile(newFileId: string): Promise<void> {
    // Cleanup previous file
    if (fileId.value && fileId.value !== newFileId) {
      await cleanup()
    }

    isInitialized.value = false
    syncState.value = "syncing"

    try {
      // Load from local storage first
      const localAnnotations = await storage.getActiveAnnotations(newFileId)
      onAnnotationsLoaded?.(localAnnotations)

      // Load local viewport state
      const localViewport = await viewportStorage.getViewportState(newFileId)
      if (localViewport) {
        const { syncStatus: _, lastModified: __, fileId: ___, ...viewportData } = localViewport
        currentViewportState.value = viewportData
        onViewportLoaded?.(viewportData)
      }

      // Try to sync with server
      if (isOnline.value) {
        const meta = await storage.getSyncMeta(newFileId)

        const response = await $fetch(`/api/files/${newFileId}/annotations`, {
          query: {
            since: meta?.lastSyncTime || undefined,
            includeDeleted: true
          }
        })

        const {
          annotations: serverAnnotations,
          meta: responseMeta,
          viewportState: serverViewport
        } = response as {
          annotations: Array<{
            id: string
            type: string
            pageNum: number
            version: number
            deletedAt: string | null
            [key: string]: unknown
          }>
          meta: { serverTime: string; lastModified: string | null }
          viewportState: ViewportState | null
        }

        // Handle viewport state from server
        if (serverViewport) {
          currentViewportState.value = serverViewport
          await viewportStorage.applyServerState(newFileId, serverViewport)
          onViewportLoaded?.(serverViewport)
        }

        // Handle annotations from server
        if (!meta?.lastSyncTime && serverAnnotations.length > 0) {
          await storage.bulkSaveFromServer(newFileId, serverAnnotations)
        } else if (serverAnnotations.length > 0) {
          await storage.applyServerUpdates(newFileId, serverAnnotations)
        }

        await storage.updateSyncMeta(newFileId, responseMeta.serverTime, responseMeta.serverTime)
        lastSyncTime.value = responseMeta.serverTime

        // Reload from storage after server sync
        const updatedAnnotations = await storage.getActiveAnnotations(newFileId)
        onAnnotationsLoaded?.(updatedAnnotations)
      }

      pendingCount.value = await storage.getPendingCount(newFileId)
      syncState.value = pendingCount.value > 0 ? "idle" : "idle"
      isInitialized.value = true

      // Set up background sync
      if (backgroundInterval) clearInterval(backgroundInterval)
      backgroundInterval = setInterval(() => {
        if (isOnline.value && hasPendingChanges.value && !isSyncing) {
          performSync()
        }
      }, BACKGROUND_INTERVAL_MS)

      // Set up event listeners
      if (import.meta.client) {
        window.addEventListener("beforeunload", handleBeforeUnload)
        document.addEventListener("visibilitychange", handleVisibilityChange)
      }
    } catch (error) {
      console.error("Failed to initialize sync:", error)
      syncError.value = error instanceof Error ? error.message : "Failed to load"
      syncState.value = "error"
      isInitialized.value = true
    }
  }

  function handleBeforeUnload(): void {
    if (hasPendingChanges.value) {
      performSync(true)
    }
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === "hidden" && hasPendingChanges.value) {
      performSync(true)
    }
  }

  /**
   * Cleanup when switching files or unmounting
   */
  async function cleanup(): Promise<void> {
    if (syncTimeout) clearTimeout(syncTimeout)
    if (maxWaitTimeout) clearTimeout(maxWaitTimeout)
    if (backgroundInterval) clearInterval(backgroundInterval)

    if (import.meta.client) {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }

    // Sync any pending changes before cleanup
    if (hasPendingChanges.value && isOnline.value) {
      await performSync()
    }

    syncTimeout = null
    maxWaitTimeout = null
    backgroundInterval = null
  }

  // ============================================
  // Public API for persisting changes
  // ============================================

  /**
   * Persist a new or updated annotation
   */
  async function persistAnnotation(annotation: Annotation, isNew: boolean = false): Promise<void> {
    const currentFileId = fileId.value
    if (!currentFileId) return

    await storage.saveToLocal(currentFileId, annotation, isNew)
    pendingCount.value = await storage.getPendingCount(currentFileId)
    triggerSync()
  }

  /**
   * Persist an annotation deletion
   */
  async function persistDeletion(annotationId: string): Promise<void> {
    const currentFileId = fileId.value
    if (!currentFileId) return

    await storage.deleteFromLocal(currentFileId, annotationId)
    pendingCount.value = await storage.getPendingCount(currentFileId)
    triggerSync()
  }

  /**
   * Queue viewport state for sync
   */
  function persistViewportState(state: ViewportState): void {
    const currentFileId = fileId.value
    if (!currentFileId) return

    pendingViewportState.value = state
    viewportStorage.saveViewportState(currentFileId, state)
    triggerSync()
  }

  // ============================================
  // Auto-persist via store action interception
  // ============================================

  // Intercept annotation store actions to auto-persist changes
  // This is cleaner than inject/provide as it requires no changes to tools
  annotationStore.$onAction(({ name, args, after }) => {
    after((result) => {
      // Only persist if we have a file loaded
      if (!fileId.value) return

      if (name === "addAnnotation" && result) {
        persistAnnotation(result as Annotation, true)
      } else if (name === "updateAnnotation" && result) {
        if (annotationStore.persistenceSuppressed) return
        persistAnnotation(result as Annotation, false)
      } else if (name === "deleteAnnotation" && args[0]) {
        persistDeletion(args[0] as string)
      } else if (name === "flushPersistence") {
        const annotations = result as Annotation[]
        for (const annotation of annotations) {
          persistAnnotation(annotation, false)
        }
      }
    })
  })

  return {
    // State
    syncState: readonly(syncState),
    lastSyncTime: readonly(lastSyncTime),
    syncError: readonly(syncError),
    pendingCount: readonly(pendingCount),
    isInitialized: readonly(isInitialized),
    hasPendingChanges,
    isOnline,
    currentViewportState: readonly(currentViewportState),

    // Actions
    initializeForFile,
    forceSync,
    cleanup,

    // Viewport persistence (for viewport store watching)
    persistViewportState
  }
}
