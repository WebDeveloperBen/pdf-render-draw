import * as schema from "@shared/db/schema"
import { useRuntimeConfig } from "#imports"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres"
import { neon } from "@neondatabase/serverless"
import pg from "pg"

/**
 * Database connection supporting both:
 * - Local PostgreSQL (via pg driver) for development
 * - Neon Serverless (via HTTP) for production
 */

type DrizzleDB = ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>

let _db: DrizzleDB | null = null

function getRuntimeConfig() {
  try {
    return useRuntimeConfig()
  } catch {
    return undefined
  }
}

function createDb(): DrizzleDB {
  const runtimeConfig = getRuntimeConfig()
  const connectionString = runtimeConfig?.databaseUrl || process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required")
  }

  // Use Neon serverless driver for Neon URLs, pg for local/other PostgreSQL
  const isNeon = connectionString.includes("neon.tech")

  if (isNeon) {
    const sql = neon(connectionString)
    return drizzleNeon(sql, { schema })
  } else {
    const pool = new pg.Pool({ connectionString })
    return drizzlePg(pool, { schema })
  }
}

// Lazy initialize db
export const db = new Proxy({} as DrizzleDB, {
  get(_target, prop) {
    if (!_db) {
      _db = createDb()
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop]
  }
})

export const useDrizzle = () => {
  if (!_db) {
    _db = createDb()
  }
  return _db
}

export const tables = schema

export const UserInsert = schema.user.$inferInsert
export type UserRegisterType = Omit<typeof UserInsert, "createdAt" | "updatedAt" | "id" | "emailVerified">
