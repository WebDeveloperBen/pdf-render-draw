import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { ref } from "vue"

const saveToLocal = vi.fn(async () => {})
const deleteFromLocal = vi.fn(async () => {})
const getPendingCount = vi.fn(async () => 0)
const getPendingOperations = vi.fn(async () => [])
const getSyncMeta = vi.fn(async () => undefined)
const markSynced = vi.fn(async () => {})
const applyServerUpdates = vi.fn(async () => {})
const updateSyncMeta = vi.fn(async () => {})
const getActiveAnnotations = vi.fn(async () => [])
const bulkSaveFromServer = vi.fn(async () => {})

const saveViewportState = vi.fn(async () => {})
const applyServerState = vi.fn(async () => {})
const getViewportState = vi.fn(async () => undefined)

const isOnline = ref(true)

vi.mock("@/composables/useAnnotationStorage", () => ({
  useAnnotationStorage: () => ({
    saveToLocal,
    deleteFromLocal,
    getPendingCount,
    getPendingOperations,
    getSyncMeta,
    markSynced,
    applyServerUpdates,
    updateSyncMeta,
    getActiveAnnotations,
    bulkSaveFromServer
  })
}))

vi.mock("@/composables/useViewportStorage", () => ({
  useViewportStorage: () => ({
    saveViewportState,
    applyServerState,
    getViewportState
  })
}))

vi.mock("@vueuse/core", async () => {
  const actual = await vi.importActual<typeof import("@vueuse/core")>("@vueuse/core")
  return {
    ...actual,
    useOnline: () => isOnline
  }
})

describe("useEditorSync", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    isOnline.value = true
  })

  it("skips IndexedDB writes during suppressed transform updates and flushes once at the end", async () => {
    const annotationStore = useAnnotationStore()
    const fileId = ref("file-sync-spec")

    useEditorSync({
      fileId,
      annotationStore
    })

    const annotation: Measurement = {
      id: "measure-sync",
      type: "measure",
      pageNum: 1,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      distance: 100,
      midpoint: { x: 50, y: 0 },
      labelRotation: 0,
      rotation: 0
    }

    annotationStore.addAnnotation(annotation)
    vi.clearAllMocks()

    annotationStore.setPersistenceSuppressed(true)
    annotationStore.updateAnnotation("measure-sync", {
      points: [
        { x: 20, y: 0 },
        { x: 120, y: 0 }
      ]
    })

    await Promise.resolve()
    expect(saveToLocal).not.toHaveBeenCalled()

    annotationStore.setPersistenceSuppressed(false)
    annotationStore.flushPersistence(["measure-sync"])

    await Promise.resolve()
    expect(saveToLocal).toHaveBeenCalledTimes(1)
    expect(saveToLocal).toHaveBeenCalledWith(
      "file-sync-spec",
      expect.objectContaining({
        id: "measure-sync",
        points: [
          { x: 20, y: 0 },
          { x: 120, y: 0 }
        ]
      }),
      false
    )
  })
})
