import { defineConfig } from "vitest/config"
import { defineVitestProject } from "@nuxt/test-utils/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/composables/**/*.ts", "app/stores/**/*.ts", "app/utils/**/*.ts", "app/components/**/*.ts"],
      exclude: ["app/**/*.spec.ts", "app/**/*.test.ts", "node_modules/**"]
    },
    projects: [
      await defineVitestProject({
        test: {
          name: "nuxt",
          include: ["app/**/*.spec.ts"],
          exclude: ["app/tests/e2e/**/*.spec.ts", "node_modules/**"],
          environment: "nuxt",
          hookTimeout: 30_000,
          environmentOptions: {
            nuxt: {
              mock: {
                intersectionObserver: true,
                indexedDb: true
              }
            }
          },
          globals: true,
          setupFiles: ["./test/setup.ts"]
        }
      }),
      await defineVitestProject({
        test: {
          name: "server",
          include: ["server/**/*.spec.ts"],
          exclude: ["node_modules/**"],
          environment: "nuxt",
          globals: true
        }
      })
    ]
  }
})
