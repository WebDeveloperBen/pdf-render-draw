import { describe, expect, it } from "vitest"
import { getOptionalRuntimeConfig } from "./runtime-config"

describe("getOptionalRuntimeConfig", () => {
  it("returns the active Nuxt runtime config without throwing", () => {
    const config = getOptionalRuntimeConfig()

    expect(config).toEqual(
      expect.objectContaining({
        public: expect.objectContaining({
          app: expect.objectContaining({
            name: expect.any(String)
          })
        })
      })
    )
  })
})
