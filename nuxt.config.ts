import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { fileURLToPath } from "node:url"

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined || process.env.BUILD_TARGET === "tauri"

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  future: { typescriptBundlerResolution: true, compatibilityVersion: 5 },
  devtools: { enabled: !isTauri },
  telemetry: false,
  ssr: !isTauri,
  css: ["./app/assets/css/tailwind.css", "~/assets/css/tailwind.css"],
  experimental: {
    viewTransition: true,
    typedPages: true,
    typescriptPlugin: true,
    enforceModuleCompatibility: true
  },
  typescript: {
    typeCheck: "build",
    strict: true
  },

  alias: {
    "@auth": fileURLToPath(new URL("./auth.ts", import.meta.url)),
    "@shared": fileURLToPath(new URL("./shared", import.meta.url))
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
    azureOpenaiApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenaiApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview",
    azureOpenaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
    azureOpenaiDeployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM || "PDF Annotator <noreply@resend.dev>",
    // Public (exposed to client)
    public: {
      betterAuthUrl: process.env.BETTER_AUTH_URL,
      // App branding (accessible on both client and server)
      app: {
        name: "PDF Annotator",
        domain: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        shortName: "PDF",
        description: "Draw and measure PDF documents with precision",
        tagline: "Annotate with precision",
        brandColor: "#f97316",
        footerText: "Professional PDF annotation tools"
      },
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      logger: {
        client: {
          level: "info"
        }
      }
    },
    logger: {
      server: {
        level: "info"
      }
    }
  },

  modules: [
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "@nuxt/eslint",
    "@nuxt/test-utils/module",
    "@nuxtjs/color-mode",
    "motion-v/nuxt",
    "@nuxt/icon",
    "@nuxt/fonts",
    "reka-ui/nuxt",
    "@yuta-inoue-ph/nuxt-vcalendar",
    "@vee-validate/nuxt",
    "vue-sonner/nuxt"
  ],

  pinia: {
    storesDirs: ["./stores/**"]
  },

  imports: {
    dirs: ["./types", "./shared/db/schema/", "./models"],
    imports: [
      {
        from: "tailwind-variants",
        name: "tv"
      },
      {
        from: "tailwind-variants",
        name: "VariantProps",
        type: true
      },
      {
        from: "vue-sonner",
        name: "toast",
        as: "useSonner"
      }
    ]
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
    host: "0",
    port: isTauri ? 3001 : 3000 // avoid cached service workers
  },

  // Avoids error [unhandledRejection] EMFILE: too many open files, watch
  ignore: ["**/src-tauri/**"],

  colorMode: {
    preference: "dark",
    fallback: "dark",
    storageKey: "pdf-render-draw-color-mode",
    classSuffix: ""
  },

  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 0
    },

    mode: "svg",
    class: "shrink-0",
    fetchTimeout: 2000,
    serverBundle: "local"
  },

  app: {
    head: {
      script: [
        {
          src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js",
          defer: true
        },
        {
          src: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/vfs_fonts.min.js",
          defer: true
        }
      ]
    }
  },
  nitro: {
    preset: "node-server",
    imports: { dirs: ["./shared/db/schema/"] },
    rollupConfig: {
      plugins: [vue()]
    },
    openAPI: {
      route: "/_docs/openapi.json",
      production: false,
      meta: {
        title: "PDF Annotator API",
        description: `
## Introduction

The PDF Annotator API powers a collaborative PDF annotation platform designed for tradespeople to draw, measure, and annotate building plans.

### Authentication

All authenticated endpoints require a valid session cookie. Authentication is handled via [Better Auth](https://better-auth.com) supporting:
- Email/password login
- OAuth providers (Google, GitHub)
- Magic link authentication for share recipients

### Organizations

Users belong to organizations. Each user has a personal "home" organization created on signup. Projects are scoped to organizations, enabling team collaboration.

### Sharing

Projects can be shared via:
- **Public links** - Anyone with the link can view (optionally password-protected)
- **Private shares** - Specific recipients receive magic link access via email

### Rate Limits

API requests are subject to rate limiting. Contact support for higher limits.
        `.trim(),
        version: "1.0.0"
      },
      ui: {
        scalar: {
          theme: "purple",
          route: "/docs",
          sources: [
            { url: "/_docs/openapi.json", title: "API" },
            { url: "/api/auth/open-api/generate-schema", title: "Auth" }
          ]
        }
      }
    },
    experimental: {
      openAPI: true
    },
  }
})
