/**
 * Development Seed Script
 *
 * Creates comprehensive demo data for local development.
 * This script is idempotent - safe to run multiple times.
 *
 * Usage:
 *   pnpm db:seed-dev
 *
 * Data created:
 * - 4 users: admin, regular user, team member, guest
 * - 2 organizations with members
 * - Sample projects with annotations
 * - Project shares with recipients
 * - Platform admin record for admin user
 */

import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq, and } from "drizzle-orm"
import * as schema from "../shared/db/schema"
import { hashPassword } from "better-auth/crypto"
import * as crypto from "crypto"

const {
  user,
  account,
  organization,
  member,
  project,
  projectFile,
  projectShare,
  projectShareRecipient,
  platformAdmin
} = schema

interface SeedUser {
  id: string
  email: string
  name: string
  firstName: string
  lastName: string
  isGuest?: boolean
  role?: string
}

interface SeedOrg {
  id: string
  name: string
  slug: string
  logo?: string
}

// Predefined UUIDs for consistent seeding (valid UUID v4 format)
const SEED_IDS = {
  users: {
    admin: "00000000-0000-4000-8000-000000000001",
    user: "00000000-0000-4000-8000-000000000002",
    team: "00000000-0000-4000-8000-000000000003",
    guest: "00000000-0000-4000-8000-000000000004"
  },
  orgs: {
    acme: "00000000-0000-4000-8000-000000000010",
    demo: "00000000-0000-4000-8000-000000000011"
  },
  projects: {
    floorPlan: "00000000-0000-4000-8000-000000000020",
    sitePlan: "00000000-0000-4000-8000-000000000021",
    electrical: "00000000-0000-4000-8000-000000000022"
  },
  files: {
    floorPlanFile: "00000000-0000-4000-8000-000000000050",
    sitePlanFile: "00000000-0000-4000-8000-000000000051",
    sitePlanRevision: "00000000-0000-4000-8000-000000000052",
    electricalFile: "00000000-0000-4000-8000-000000000053"
  },
  shares: {
    publicShare: "00000000-0000-4000-8000-000000000030",
    privateShare: "00000000-0000-4000-8000-000000000031"
  }
}

const DEMO_USERS: SeedUser[] = [
  {
    id: SEED_IDS.users.admin,
    email: "owner@platform.com",
    name: "Platform Owner",
    firstName: "Platform",
    lastName: "Owner",
    role: "platform_admin"
  },
  {
    id: SEED_IDS.users.user,
    email: "user@example.com",
    name: "Demo User",
    firstName: "Demo",
    lastName: "User"
  },
  {
    id: SEED_IDS.users.team,
    email: "team@example.com",
    name: "Team Member",
    firstName: "Team",
    lastName: "Member"
  },
  {
    id: SEED_IDS.users.guest,
    email: "guest@example.com",
    name: "Guest User",
    firstName: "Guest",
    lastName: "User",
    isGuest: true
  }
]

const DEMO_ORGS: SeedOrg[] = [
  {
    id: SEED_IDS.orgs.acme,
    name: "Acme Construction",
    slug: "acme-construction"
  },
  {
    id: SEED_IDS.orgs.demo,
    name: "Demo Corp",
    slug: "demo-corp"
  }
]

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex")
}

async function seedDev() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error("Error: DATABASE_URL environment variable is required")
    process.exit(1)
  }

  console.log("🌱 Starting development seed...")
  console.log("")

  const sql = neon(databaseUrl)
  const db = drizzle(sql, { schema })

  try {
    // ==========================================
    // 1. SEED USERS
    // ==========================================
    console.log("👤 Seeding users...")

    for (const demoUser of DEMO_USERS) {
      const [existing] = await db.select().from(user).where(eq(user.email, demoUser.email)).limit(1)

      if (existing) {
        console.log(`   ✓ User ${demoUser.email} already exists`)
        // Update the ID to match seed ID if different
        if (existing.id !== demoUser.id) {
          console.log(`   ⚠ User exists with different ID, skipping...`)
        }
      } else {
        await db.insert(user).values({
          id: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          emailVerified: true,
          isGuest: demoUser.isGuest ?? false,
          role: demoUser.role ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log(`   + Created user: ${demoUser.email}`)

        // Create credential account for non-guest users
        if (!demoUser.isGuest) {
          const passwordHash = await hashPassword("password123")
          await db.insert(account).values({
            id: `${demoUser.id}-credential`,
            accountId: demoUser.id,
            providerId: "credential",
            userId: demoUser.id,
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          console.log(`   + Created credential account for: ${demoUser.email}`)
        }
      }
    }

    // ==========================================
    // 2. SEED PLATFORM ADMIN
    // ==========================================
    console.log("")
    console.log("🔑 Seeding platform admin...")

    const adminUserId = SEED_IDS.users.admin
    const [existingAdmin] = await db.select().from(platformAdmin).where(eq(platformAdmin.userId, adminUserId)).limit(1)

    if (existingAdmin) {
      console.log("   ✓ Platform admin already exists")
    } else {
      // Check if user exists first
      const [adminUser] = await db.select().from(user).where(eq(user.id, adminUserId)).limit(1)

      if (adminUser) {
        await db.insert(platformAdmin).values({
          id: `${adminUserId}-platform-admin`,
          userId: adminUserId,
          tier: "owner",
          grantedBy: null,
          grantedAt: new Date(),
          notes: "Seeded platform owner for development"
        })
        console.log("   + Created platform admin (owner tier)")
      } else {
        console.log("   ⚠ Admin user not found, skipping platform admin creation")
      }
    }

    // ==========================================
    // 3. SEED ORGANIZATIONS
    // ==========================================
    console.log("")
    console.log("🏢 Seeding organizations...")

    for (const org of DEMO_ORGS) {
      const [existing] = await db.select().from(organization).where(eq(organization.slug, org.slug)).limit(1)

      if (existing) {
        console.log(`   ✓ Organization ${org.name} already exists`)
      } else {
        await db.insert(organization).values({
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo: org.logo ?? null,
          createdAt: new Date()
        })
        console.log(`   + Created organization: ${org.name}`)
      }
    }

    // ==========================================
    // 4. SEED ORGANIZATION MEMBERS
    // ==========================================
    console.log("")
    console.log("👥 Seeding organization memberships...")

    const memberships = [
      // Acme Construction members
      { orgId: SEED_IDS.orgs.acme, userId: SEED_IDS.users.admin, role: "owner" },
      { orgId: SEED_IDS.orgs.acme, userId: SEED_IDS.users.user, role: "admin" },
      { orgId: SEED_IDS.orgs.acme, userId: SEED_IDS.users.team, role: "member" },
      // Demo Corp members
      { orgId: SEED_IDS.orgs.demo, userId: SEED_IDS.users.user, role: "owner" },
      { orgId: SEED_IDS.orgs.demo, userId: SEED_IDS.users.team, role: "member" }
    ]

    for (const m of memberships) {
      const [existing] = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, m.orgId), eq(member.userId, m.userId)))
        .limit(1)

      if (existing) {
        console.log(`   ✓ Membership already exists: ${m.userId} in ${m.orgId}`)
      } else {
        await db.insert(member).values({
          id: `member-${m.orgId}-${m.userId}`,
          organizationId: m.orgId,
          userId: m.userId,
          role: m.role,
          createdAt: new Date()
        })
        console.log(`   + Added ${m.role} to org: ${m.userId}`)
      }
    }

    // ==========================================
    // 5. SEED PROJECTS
    // ==========================================
    console.log("")
    console.log("📁 Seeding projects...")

    const projects = [
      {
        id: SEED_IDS.projects.floorPlan,
        name: "Office Floor Plan",
        description: "Main office building floor plan with measurements",
        createdBy: SEED_IDS.users.user,
        organizationId: SEED_IDS.orgs.acme
      },
      {
        id: SEED_IDS.projects.sitePlan,
        name: "Construction Site Plan",
        description: "Full site layout with building footprints",
        createdBy: SEED_IDS.users.admin,
        organizationId: SEED_IDS.orgs.acme
      },
      {
        id: SEED_IDS.projects.electrical,
        name: "Electrical Layout",
        description: "Electrical wiring and outlet placement",
        createdBy: SEED_IDS.users.user,
        organizationId: null // Personal project
      }
    ]

    for (const proj of projects) {
      const [existing] = await db.select().from(project).where(eq(project.id, proj.id)).limit(1)

      if (existing) {
        console.log(`   ✓ Project ${proj.name} already exists`)
      } else {
        await db.insert(project).values({
          ...proj,
          annotationCount: 0,
          lastViewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log(`   + Created project: ${proj.name}`)
      }
    }

    // ==========================================
    // 5b. SEED PROJECT FILES
    // ==========================================
    console.log("")
    console.log("📄 Seeding project files...")

    const projectFiles = [
      {
        id: SEED_IDS.files.floorPlanFile,
        projectId: SEED_IDS.projects.floorPlan,
        pdfUrl: "https://example.com/demo/floor-plan.pdf",
        pdfFileName: "floor-plan.pdf",
        pdfFileSize: 2500000,
        pageCount: 3,
        uploadedBy: SEED_IDS.users.user
      },
      {
        id: SEED_IDS.files.sitePlanFile,
        projectId: SEED_IDS.projects.sitePlan,
        pdfUrl: "https://example.com/demo/site-plan.pdf",
        pdfFileName: "site-plan.pdf",
        pdfFileSize: 5000000,
        pageCount: 8,
        uploadedBy: SEED_IDS.users.admin
      },
      {
        id: SEED_IDS.files.sitePlanRevision,
        projectId: SEED_IDS.projects.sitePlan,
        pdfUrl: "https://example.com/demo/site-plan-v2.pdf",
        pdfFileName: "site-plan-v2.pdf",
        pdfFileSize: 5200000,
        pageCount: 10,
        uploadedBy: SEED_IDS.users.admin
      },
      {
        id: SEED_IDS.files.electricalFile,
        projectId: SEED_IDS.projects.electrical,
        pdfUrl: "https://example.com/demo/electrical.pdf",
        pdfFileName: "electrical.pdf",
        pdfFileSize: 1800000,
        pageCount: 2,
        uploadedBy: SEED_IDS.users.user
      }
    ]

    for (const file of projectFiles) {
      const [existing] = await db.select().from(projectFile).where(eq(projectFile.id, file.id)).limit(1)

      if (existing) {
        console.log(`   ✓ File ${file.pdfFileName} already exists`)
      } else {
        await db.insert(projectFile).values({
          ...file,
          annotationCount: 0,
          lastViewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log(`   + Created file: ${file.pdfFileName}`)
      }
    }

    // ==========================================
    // 6. SEED SHARES
    // ==========================================
    console.log("")
    console.log("🔗 Seeding project shares...")

    const shares = [
      {
        id: SEED_IDS.shares.publicShare,
        projectId: SEED_IDS.projects.floorPlan,
        token: "demo-public-share-token",
        createdBy: SEED_IDS.users.user,
        name: "Public Share - Floor Plan",
        shareType: "public",
        message: "Check out our office floor plan!",
        allowDownload: true,
        allowNotes: false,
        password: null,
        expiresAt: null
      },
      {
        id: SEED_IDS.shares.privateShare,
        projectId: SEED_IDS.projects.sitePlan,
        token: "demo-private-share-token",
        createdBy: SEED_IDS.users.admin,
        name: "Private Share - Site Plan",
        shareType: "private",
        message: "Here's the site plan for review. Please keep confidential.",
        allowDownload: false,
        allowNotes: true,
        password: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    ]

    for (const share of shares) {
      const [existing] = await db.select().from(projectShare).where(eq(projectShare.id, share.id)).limit(1)

      if (existing) {
        console.log(`   ✓ Share ${share.name} already exists`)
      } else {
        await db.insert(projectShare).values({
          ...share,
          viewCount: 0,
          lastViewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        console.log(`   + Created share: ${share.name}`)
      }
    }

    // ==========================================
    // 7. SEED SHARE RECIPIENTS (for private shares)
    // ==========================================
    console.log("")
    console.log("📧 Seeding share recipients...")

    const recipients = [
      {
        id: "00000000-0000-4000-8000-000000000040",
        shareId: SEED_IDS.shares.privateShare,
        email: "guest@example.com",
        status: "pending",
        userId: SEED_IDS.users.guest
      },
      {
        id: "00000000-0000-4000-8000-000000000041",
        shareId: SEED_IDS.shares.privateShare,
        email: "external@contractor.com",
        status: "pending",
        userId: null
      }
    ]

    for (const recipient of recipients) {
      const [existing] = await db
        .select()
        .from(projectShareRecipient)
        .where(
          and(eq(projectShareRecipient.shareId, recipient.shareId), eq(projectShareRecipient.email, recipient.email))
        )
        .limit(1)

      if (existing) {
        console.log(`   ✓ Recipient ${recipient.email} already exists`)
      } else {
        await db.insert(projectShareRecipient).values({
          ...recipient,
          viewCount: 0,
          invitedAt: new Date(),
          firstViewedAt: null,
          lastViewedAt: null
        })
        console.log(`   + Added recipient: ${recipient.email}`)
      }
    }

    // ==========================================
    // DONE
    // ==========================================
    console.log("")
    console.log("✅ Development seed completed successfully!")
    console.log("")
    console.log("📋 Demo Accounts:")
    console.log("   Owner:  owner@platform.com / password123")
    console.log("   User:   user@example.com / password123")
    console.log("   Team:   team@example.com / password123")
    console.log("   Guest:  guest@example.com (magic link only)")
    console.log("")
    console.log("🔗 Demo Share Links:")
    console.log("   Public:  /share/demo-public-share-token")
    console.log("   Private: /share/demo-private-share-token")
    console.log("")
  } catch (error) {
    console.error("❌ Error seeding database:", error)
    process.exit(1)
  }

  process.exit(0)
}

seedDev()
