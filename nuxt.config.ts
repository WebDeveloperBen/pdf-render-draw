export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  // Disable SSR - PDF.js requires browser APIs
  ssr: false,

  modules: ["@pinia/nuxt", "@vueuse/nuxt", "@nuxt/eslint", "@nuxt/test-utils/module"],
  pinia: {
    storesDirs: ["./stores/**"]
  },
  // required for pdfjs-dist top level await usage
  vite: {
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

