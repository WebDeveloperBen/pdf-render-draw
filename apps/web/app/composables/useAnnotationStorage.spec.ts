import { beforeEach, describe, expect, it } from "vitest"
import "fake-indexeddb/auto"

function createMeasurement(overrides: Partial<Measurement> = {}): Measurement {
  return {
    id: "measure-1",
    type: "measure",
    pageNum: 1,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ],
    distance: 100,
    midpoint: { x: 50, y: 0 },
    labelRotation: 0,
    rotation: 0,
    ...overrides
  }
}

describe("useAnnotationStorage", () => {
  const fileId = "file-storage-spec"
  let storage: ReturnType<typeof useAnnotationStorage>

  beforeEach(async () => {
    storage = useAnnotationStorage()
    await storage.clearFileData(fileId)
  })

  it("keeps the base server version across repeated unsynced edits", async () => {
    await storage.bulkSaveFromServer(fileId, [
      {
        ...createMeasurement(),
        version: 3,
        deletedAt: null
      }
    ])

    await storage.saveToLocal(fileId, createMeasurement({ distance: 120, midpoint: { x: 60, y: 0 } }))
    await storage.saveToLocal(fileId, createMeasurement({ distance: 140, midpoint: { x: 70, y: 0 } }))

    const [pendingOperation] = await storage.getPendingOperations(fileId)
    const stored = await storage.getAnnotation("measure-1")

    expect(pendingOperation?.localVersion).toBe(3)
    expect(stored?.version).toBe(3)
    expect(stored?.syncStatus).toBe("pending")
  })

  it("advances multiple annotations independently when markSynced receives several IDs", async () => {
    await storage.bulkSaveFromServer(fileId, [
      { ...createMeasurement({ id: "m-1" }), version: 2, deletedAt: null },
      { ...createMeasurement({ id: "m-2" }), version: 5, deletedAt: null }
    ])

    await storage.saveToLocal(fileId, createMeasurement({ id: "m-1", distance: 110 }))
    await storage.saveToLocal(fileId, createMeasurement({ id: "m-2", distance: 220 }))
    await storage.markSynced(["m-1", "m-2"])

    const s1 = await storage.getAnnotation("m-1")
    const s2 = await storage.getAnnotation("m-2")

    expect(s1?.version).toBe(3)
    expect(s1?.syncStatus).toBe("synced")
    expect(s2?.version).toBe(6)
    expect(s2?.syncStatus).toBe("synced")
    expect(await storage.getPendingCount(fileId)).toBe(0)
  })

  it("marks synced even when no pending operation exists for the annotation", async () => {
    await storage.bulkSaveFromServer(fileId, [
      { ...createMeasurement(), version: 1, deletedAt: null }
    ])

    // markSynced without a prior saveToLocal — no pending operation
    await storage.markSynced(["measure-1"])

    const stored = await storage.getAnnotation("measure-1")
    expect(stored?.syncStatus).toBe("synced")
    expect(stored?.version).toBe(1) // unchanged — no pending op to advance from
  })

  it("advances to the confirmed server version after sync succeeds", async () => {
    await storage.bulkSaveFromServer(fileId, [
      {
        ...createMeasurement(),
        version: 4,
        deletedAt: null
      }
    ])

    await storage.saveToLocal(fileId, createMeasurement({ distance: 150, midpoint: { x: 75, y: 0 } }))
    await storage.markSynced(["measure-1"])

    const stored = await storage.getAnnotation("measure-1")

    expect(stored?.version).toBe(5)
    expect(stored?.syncStatus).toBe("synced")
    expect(await storage.getPendingCount(fileId)).toBe(0)
  })
})
