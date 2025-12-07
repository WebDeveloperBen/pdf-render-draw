import * as schema from "../../shared/db/schema"
import { drizzle } from "drizzle-orm/node-postgres"

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: !import.meta.dev
  },
  schema
})

export const useDrizzle = () => db

export const tables = schema

export const UserInsert = schema.user.$inferInsert
export type UserRegisterType = Omit<typeof UserInsert, "createdAt" | "updatedAt" | "id" | "emailVerified">
