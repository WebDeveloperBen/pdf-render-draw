/**
 * Seed script to create the initial platform owner
 *
 * Usage:
 *   PLATFORM_OWNER_EMAIL=you@example.com pnpm db:seed-owner
 *
 * This script:
 * 1. Finds the user by email
 * 2. Creates a platform_admin record with tier='owner'
 * 3. Skips if already exists
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { eq } from "drizzle-orm"
import * as schema from "../shared/db/schema"

const { user, platformAdmin } = schema

async function seedOwner() {
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL

  if (!ownerEmail) {
    console.error("Error: PLATFORM_OWNER_EMAIL environment variable is required")
    console.error("Usage: PLATFORM_OWNER_EMAIL=you@example.com pnpm db:seed-owner")
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error("Error: DATABASE_URL environment variable is required")
    process.exit(1)
  }

  console.log(`Seeding platform owner with email: ${ownerEmail}`)

  const db = drizzle({
    connection: { connectionString: databaseUrl },
    schema
  })

  try {
    // Find the user by email
    const [foundUser] = await db.select().from(user).where(eq(user.email, ownerEmail)).limit(1)

    if (!foundUser) {
      console.error(`Error: User with email "${ownerEmail}" not found`)
      console.error("Please ensure the user has registered first")
      process.exit(1)
    }

    console.log(`Found user: ${foundUser.name} (${foundUser.id})`)

    // Check if already a platform admin
    const [existing] = await db
      .select()
      .from(platformAdmin)
      .where(eq(platformAdmin.userId, foundUser.id))
      .limit(1)

    if (existing) {
      if (existing.tier === "owner") {
        console.log("User is already the platform owner - no changes needed")
      } else {
        console.log(`User is already a platform admin with tier: ${existing.tier}`)
        console.log("Updating to owner tier...")

        await db
          .update(platformAdmin)
          .set({ tier: "owner", notes: "Upgraded to owner via seed script" })
          .where(eq(platformAdmin.userId, foundUser.id))

        console.log("Successfully upgraded to platform owner!")
      }
      process.exit(0)
    }

    // Check if there's already an owner
    const [existingOwner] = await db
      .select()
      .from(platformAdmin)
      .where(eq(platformAdmin.tier, "owner"))
      .limit(1)

    if (existingOwner) {
      console.error("Error: A platform owner already exists")
      console.error("There can only be one owner. Remove the existing owner first if needed.")
      process.exit(1)
    }

    // Create the platform admin record
    await db.insert(platformAdmin).values({
      id: crypto.randomUUID(),
      userId: foundUser.id,
      tier: "owner",
      grantedBy: null,
      grantedAt: new Date(),
      notes: "Initial platform owner - created via seed script"
    })

    console.log("Successfully created platform owner!")
    console.log(`  User: ${foundUser.name}`)
    console.log(`  Email: ${foundUser.email}`)
    console.log(`  Tier: owner`)
  } catch (error) {
    console.error("Error seeding platform owner:", error)
    process.exit(1)
  }

  process.exit(0)
}

seedOwner()
