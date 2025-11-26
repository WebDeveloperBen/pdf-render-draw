import tailwindcss from "@tailwindcss/vite"

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined || process.env.BUILD_TARGET === "tauri"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: !isTauri },
  telemetry: false,
  ssr: !isTauri,
  css: ["./app/assets/css/main.css"],
  typescript: {
    typeCheck: true,
    strict: true,
    sharedTsConfig: { compilerOptions: { removeComments: true, allowUnreachableCode: false, alwaysStrict: true } }
  },

  // Runtime configuration
  runtimeConfig: {
    // Server-only (not exposed to client)
    databaseUrl: process.env.DATABASE_URL,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      s3Bucket: process.env.AWS_S3_BUCKET
    },

    // Public (exposed to client)
    public: {
      betterAuthUrl: process.env.BETTER_AUTH_URL,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    }
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
    },
    // Better support for Tauri CLI output
    clearScreen: false,
    // Enable environment variables
    // Additional environment variables can be found at
    // https://v2.tauri.app/reference/environment-variables/
    envPrefix: ["VITE_", "TAURI_"],
    server: {
      // Tauri requires a consistent port
      strictPort: true
    }
  },
  // Enables the development server to be discoverable by other devices when running on iOS physical devices
  devServer: {
    host: "0"
  },
  // Avoids error [unhandledRejection] EMFILE: too many open files, watch
  ignore: ["**/src-tauri/**"]
})
