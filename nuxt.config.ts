import tailwindcss from "@tailwindcss/vite"
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  telemetry: false,
  css: ["./app/assets/css/main.css"],
  typescript: {
    typeCheck: true,
    strict: true
  },
  modules: ["@pinia/nuxt", "@vueuse/nuxt", "@nuxt/eslint", "@nuxt/test-utils/module"],
  pinia: {
    storesDirs: ["./stores/**"]
  },
  imports: {
    dirs: ["./types"]
  },
  // required for pdfjs-dist top level await usage
  vite: {
    plugins: [tailwindcss()],
    build: {
      target: "ESNEXT"
    },
    esbuild: {
      target: "ESNEXT"
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "ESNEXT"
      }
    }
  }
})
