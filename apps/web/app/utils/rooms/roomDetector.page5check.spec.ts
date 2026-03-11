import { describe, it } from "vitest"
import { readFile } from "node:fs/promises"
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"
import { extractWallSegments, detectRooms } from "./roomDetector"

describe("page5 check", () => {
  it("runs detector on house.pdf page 5", async () => {
    const data = await readFile("app/public/house.pdf")
    const task = pdfjs.getDocument({ data: new Uint8Array(data) })
    const doc = await task.promise
    const page = await doc.getPage(5)
    const vp = page.getViewport({ scale: 1 })
    const segs = await extractWallSegments(page)
    const res = await detectRooms(segs, vp.width, vp.height)
    console.log("page5-result", {
      segments: segs.length,
      rooms: res.rooms.length,
      nodeCount: res.nodeCount,
      edgeCount: res.edgeCount,
      sample: res.rooms.slice(0, 5).map((r) => ({
        area: Math.round(r.area),
        minX: Math.round(r.bounds.minX),
        minY: Math.round(r.bounds.minY),
        maxX: Math.round(r.bounds.maxX),
        maxY: Math.round(r.bounds.maxY)
      }))
    })
  })
})
