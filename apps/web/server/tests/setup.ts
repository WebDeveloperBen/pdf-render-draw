import { setup } from "@nuxt/test-utils/e2e"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { registerServerTestHooks } from "./runtime-hooks"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Boot the Nuxt server ONCE for all test files.
// setup() registers beforeAll/afterAll hooks internally.
//
// Nitro docs: development always uses `nitro_dev`, while production builds use
// deployment-specific presets. We run integration tests against Nuxt's dev
// server so the suite exercises the real app code and request pipeline without
// coupling tests to Cloudflare's production bundle output.
setup({
  rootDir: resolve(__dirname, "../.."),
  server: true,
  browser: false,
  dev: true,
  port: 3000,
  setupTimeout: 240_000
})

registerServerTestHooks()
