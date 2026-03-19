import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { deleteMultipleFromR2, existsInR2, uploadPdf, uploadToR2 } from "./r2"
import { getTestR2Store, getTestState, resetTestState } from "./test-state"

describe("R2 utilities", () => {
  beforeEach(() => {
    process.env.VITEST = "true"
    process.env.BETTER_AUTH_URL = "http://example.test"
    resetTestState()
  })

  afterEach(() => {
    Reflect.deleteProperty(process.env, "BETTER_AUTH_URL")
  })

  it("uploads files into the test R2 bucket and returns a storage URL", async () => {
    const url = await uploadToR2(new Uint8Array([1, 2, 3]), "pdfs/plan.pdf", "application/pdf")

    expect(url).toBe("http://example.test/storage/pdfs/plan.pdf")
    expect(getTestR2Store()?.get("pdfs/plan.pdf")).toEqual(new Uint8Array([1, 2, 3]))
    await expect(existsInR2("pdfs/plan.pdf")).resolves.toBe(true)
  })

  it("deletes multiple files when storage URLs are passed back in", async () => {
    const store = getTestR2Store()
    store?.set("pdfs/one.pdf", new Uint8Array([1]))
    store?.set("pdfs/two.pdf", new Uint8Array([2]))

    await deleteMultipleFromR2(["http://example.test/storage/pdfs/one.pdf", "https://cdn.example.test/pdfs/two.pdf"])

    expect(store?.has("pdfs/one.pdf")).toBe(false)
    expect(store?.has("pdfs/two.pdf")).toBe(false)
  })

  it("surfaces upload failures from the test override", async () => {
    const state = getTestState()
    if (state) {
      state.r2.failPut = true
    }

    await expect(uploadToR2(new Uint8Array([9]), "pdfs/fail.pdf", "application/pdf")).rejects.toThrow(
      "[R2] Test override forced put() failure"
    )
  })

  it("sanitises uploaded PDF metadata", async () => {
    const result = await uploadPdf(new Uint8Array([1, 2, 3]), "site plan @ rev 1.pdf")

    expect(result.pdfUrl).toMatch(/^http:\/\/example\.test\/storage\/pdfs\/.+\.pdf$/)
    expect(result.fileName).toBe("site_plan___rev_1.pdf")
    expect(result.fileSize).toBe(3)
    expect(result.pageCount).toBe(0)
  })
})
