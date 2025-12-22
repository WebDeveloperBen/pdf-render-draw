import * as schema from "@shared/db/schema"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

/**
 * Database connection using Neon Serverless Driver
 *
 * Works in both local development and Cloudflare edge environment.
 * For Cloudflare with Hyperdrive, set DATABASE_URL to Hyperdrive connection string.
 */

const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema })

export const useDrizzle = () => db

export const tables = schema

export const UserInsert = schema.user.$inferInsert
export type UserRegisterType = Omit<typeof UserInsert, "createdAt" | "updatedAt" | "id" | "emailVerified">
