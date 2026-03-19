import { defineConfig } from "orval"

export default defineConfig({
  api: {
    hooks: { afterAllFilesWrite: "pnpm format" },
    output: {
      mode: "single", // one file
      target: "app/models/api.ts", // <-- must be a file
      client: "vue-query",
      httpClient: "fetch",
      mock: false,
      // do NOT set `schemas`
      override: {
        mutator: {
          // Custom fetch that throws on non-2xx responses for proper vue-query error handling
          path: "./app/utils/customFetch.ts",
          name: "customFetch"
        }
      }
    },
    input: {
      target: ".generated/openapi.orval.json"
    }
  }
})
