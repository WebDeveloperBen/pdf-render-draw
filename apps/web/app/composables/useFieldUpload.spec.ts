import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountSuspended } from "@nuxt/test-utils/runtime"
import { defineComponent, h } from "vue"
import { formatBytes, useFileUpload } from "./useFieldUpload"

const createObjectUrl = vi.fn(() => "blob:test")
const revokeObjectUrl = vi.fn()

describe("useFileUpload", () => {
  beforeEach(() => {
    createObjectUrl.mockClear()
    revokeObjectUrl.mockClear()
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl
    })
  })

  async function mountUploader(options: Parameters<typeof useFileUpload>[0]) {
    const state: { uploader?: ReturnType<typeof useFileUpload> } = {}

    await mountSuspended(
      defineComponent({
        setup() {
          state.uploader = useFileUpload(options)
          return () => h("div")
        }
      })
    )

    if (!state.uploader) {
      throw new Error("Failed to mount upload composable harness")
    }

    return state.uploader
  }

  it("rejects files that exceed the configured size limit", async () => {
    const onError = vi.fn()
    const uploader = await mountUploader({
      maxSize: 2,
      onError
    })

    uploader.addFiles([new File(["abcd"], "large.pdf", { type: "application/pdf" })])

    expect(uploader.files.value).toHaveLength(0)
    expect(onError).toHaveBeenCalledWith([`File exceeds the maximum size of ${formatBytes(2)}.`])
  })

  it("filters duplicate files and keeps only one copy", async () => {
    const uploader = await mountUploader({
      accept: "application/pdf",
      multiple: true
    })

    const file = new File(["abc"], "plan.pdf", { type: "application/pdf" })
    uploader.addFiles([file])
    uploader.addFiles([file])

    expect(uploader.files.value).toHaveLength(1)
  })

  it("clears files and validation errors together", async () => {
    const uploader = await mountUploader({
      accept: "application/pdf",
      multiple: true
    })

    uploader.addFiles([new File(["abc"], "plan.pdf", { type: "application/pdf" })])
    uploader.clearFiles()

    expect(uploader.files.value).toHaveLength(0)
    expect(uploader.errors.value).toEqual([])
  })
})
