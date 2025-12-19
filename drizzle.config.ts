import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./shared/db/schema/index.ts",
  out: "./shared/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
