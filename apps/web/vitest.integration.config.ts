import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@auth": fileURLToPath(new URL("./auth.ts", import.meta.url))
    }
  },
  test: {
    globalSetup: ["./server/tests/global-setup.ts"],
    setupFiles: ["./server/tests/setup.ts"],
    include: ["server/tests/suites/**/*.integration.test.ts"],
    exclude: ["server/tests/suites/**/*.prod.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 240_000,
    globals: true,
    pool: "forks",
    fileParallelism: false
  }
})
