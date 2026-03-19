import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { fileURLToPath } from "node:url"
import { version } from "./package.json"

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined || process.env.BUILD_TARGET === "tauri"
const devServerPort = process.env.PORT ? Number(process.env.PORT) : isTauri ? 3001 : 3000
const devServerHost = process.env.HOST || "0"
const useNodePgDriver = process.env.VITEST === "true" || process.env.NITRO_PRESET === "node-server"
const devWatchIgnored = [
  "**/.git/**",
  "**/.turbo/**",
  "**/.nuxt/**",
  "**/.output/**",
  "**/dist/**",
  "**/coverage/**",
  "**/node_modules/**",
  "**/.wrangler/**"
]
const freeTrialPeriodInDays = Number(
  process.env.NUXT_PUBLIC_SALES_FREE_TRIAL_PERIOD_IN_DAYS ?? process.env.SALES_FREE_TRIAL_PERIOD_IN_DAYS ?? 7
)
const nitroUnenvAliases = {
  // `resend` references this optional dep even though the app uses
  // `@vue-email/render`, so Nitro still needs a harmless stub at build time.
  "@react-email/render": "unenv/mock/proxy",
  "@aws-sdk/client-s3": "unenv/mock/proxy",
  "pg-native": "unenv/mock/proxy",
  ...(useNodePgDriver ? {} : { pg: "unenv/mock/proxy" })
}

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  future: { typescriptBundlerResolution: true, compatibilityVersion: 5 },
  devtools: { enabled: !isTauri },
  telemetry: false,
  ssr: false,
  css: ["./app/assets/css/tailwind.css", "~/assets/css/tailwind.css"],
  experimental: {
    viewTransition: true,
    typedPages: true,
    typescriptPlugin: true,
    enforceModuleCompatibility: true
  },
  typescript: {
    typeCheck: "build",
    strict: true,
    tsConfig: {
      include: ["../worker-configuration.d.ts"]
    }
  },

  alias: {
    "@auth": fileURLToPath(new URL("./auth.ts", import.meta.url)),
    "@shared": fileURLToPath(new URL("./shared", import.meta.url))
  },

  // Runtime configuration
  runtimeConfig: {
    // Server-only (not exposed to client)
    databaseUrl: "",
    betterAuthSecret: "",
    google: {
      clientId: "",
      clientSecret: ""
    },
    github: {
      clientId: "",
      clientSecret: ""
    },
    stripe: {
      secretKey: "",
      webhookSecret: ""
    },
    sales: {
      freeTrialPeriodInDays
    },
    resendApiKey: "",
    emailFrom: process.env.EMAIL_FROM || "noreply@bens.digital",
    // Public (exposed to client)
    public: {
      betterAuthUrl: process.env.BETTER_AUTH_URL,
      // App branding (accessible on both client and server)
      app: {
        name: "MetreMate",
        domain: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        shortName: "MM",
        description: "Draw and measure PDF documents with precision",
        tagline: "Annotate with precision",
        brandColor: "#f97316",
        footerText: "Professional PDF annotation tools"
      },
      appVersion: version,
      // OAuth providers — set to true when env vars are configured
      authProviders: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        github: !!process.env.GITHUB_CLIENT_ID
      },
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      sales: {
        freeTrialPeriodInDays
      },
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
    ...(process.env.VITEST ? ["@nuxt/test-utils/module" as const] : []),
    "@nuxtjs/color-mode",
    "motion-v/nuxt",
    "@nuxt/fonts",
    "reka-ui/nuxt",
    "@yuta-inoue-ph/nuxt-vcalendar",
    "nitro-cloudflare-dev",
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
  watchers: {
    chokidar: {
      ignored: devWatchIgnored
    }
  },
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
      strictPort: true,
      watch: {
        ignored: devWatchIgnored
      }
    }
  },

  // Enables the development server to be discoverable by other devices when running on iOS physical devices
  devServer: {
    // Nuxt test-utils boots `nuxi _dev` on a random PORT/HOST. Respect those
    // values so integration tests exercise the same dev Nitro pipeline instead
    // of diverging onto a separate server config.
    host: devServerHost,
    port: devServerPort // avoid cached service workers
  },

  colorMode: {
    preference: "dark",
    fallback: "dark",
    storageKey: "pdf-render-draw-color-mode",
    classSuffix: ""
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
    preset: process.env.NITRO_PRESET || "cloudflare-module",
    imports: { dirs: ["./shared/db/schema/", "./server/services/"] },
    watchOptions: {
      ignored: devWatchIgnored
    },
    rollupConfig: {
      plugins: [vue()]
    },
    minify: false,
    // Prod smoke still needs the real Node pg driver for the Testcontainers DB,
    // but the optional resend/R2 deps must stay stubbed so the Cloudflare bundle
    // can resolve cleanly under Nitro.
    unenv: {
      alias: nitroUnenvAliases
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
    }
  }
})
