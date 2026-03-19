import type { drizzle } from "drizzle-orm/node-postgres"
import type * as schemaTypes from "../../../shared/db/schema"
import {
  user,
  account,
  organization,
  member,
  project,
  projectFile,
  projectShare,
  projectShareRecipient,
  platform_admin,
  stripePlan
} from "../../../shared/db/schema"
import { SEED_IDS, DEFAULT_PASSWORD, buildUserWithAccount } from "./users"
import { buildOrg, buildMember } from "./organizations"
import { buildProject, buildProjectFile } from "./projects"
import { buildShare, buildShareRecipient } from "./shares"
import { buildStripePlan } from "./billing"
import { buildPlatformAdmin } from "./admin"

type TestDb = ReturnType<typeof drizzle<typeof schemaTypes>>

export interface SeededData {
  users: {
    admin: { id: string; email: string }
    regularUser: { id: string; email: string }
    teamMember: { id: string; email: string }
    guest: { id: string; email: string }
  }
  orgs: {
    acme: { id: string; name: string; slug: string }
    demo: { id: string; name: string; slug: string }
  }
  projects: {
    floorPlan: { id: string; name: string }
    sitePlan: { id: string; name: string }
    electrical: { id: string; name: string }
  }
  files: {
    floorPlanFile: { id: string }
    sitePlanFile: { id: string }
    sitePlanRevision: { id: string }
    electricalFile: { id: string }
  }
  shares: {
    publicShare: { id: string; token: string }
    privateShare: { id: string; token: string }
  }
  password: string
}

/**
 * Seed a standard test scenario matching seed-dev.ts patterns.
 * Creates 4 users, 2 orgs, memberships, projects, files, shares, and platform admin.
 *
 * All users have password "password123" and can be signed in via the auth API.
 */
export async function seedStandardScenario(db: TestDb): Promise<SeededData> {
  // 1. Users with credential accounts
  const adminData = await buildUserWithAccount({
    id: SEED_IDS.users.admin,
    email: "owner@platform.com",
    name: "Platform Owner",
    firstName: "Platform",
    lastName: "Owner",
    role: "platform_admin"
  })

  const userData = await buildUserWithAccount({
    id: SEED_IDS.users.user,
    email: "user@example.com",
    name: "Demo User",
    firstName: "Demo",
    lastName: "User"
  })

  const teamData = await buildUserWithAccount({
    id: SEED_IDS.users.team,
    email: "team@example.com",
    name: "Team Member",
    firstName: "Team",
    lastName: "Member"
  })

  const guestData = await buildUserWithAccount({
    id: SEED_IDS.users.guest,
    email: "guest@example.com",
    name: "Guest User",
    firstName: "Guest",
    lastName: "User",
    isGuest: true
  })

  // Insert users
  await db.insert(user).values([adminData.user, userData.user, teamData.user, guestData.user])

  // Insert accounts
  await db.insert(account).values([adminData.account, userData.account, teamData.account, guestData.account])

  // 2. Organizations
  const acmeOrg = buildOrg({
    id: SEED_IDS.orgs.acme,
    name: "Acme Construction",
    slug: "acme-construction"
  })

  const demoOrg = buildOrg({
    id: SEED_IDS.orgs.demo,
    name: "Demo Corp",
    slug: "demo-corp"
  })

  await db.insert(organization).values([acmeOrg, demoOrg])

  // 3. Memberships
  const memberships = [
    buildMember({
      id: `member-${SEED_IDS.orgs.acme}-${SEED_IDS.users.admin}`,
      organizationId: SEED_IDS.orgs.acme,
      userId: SEED_IDS.users.admin,
      role: "owner"
    }),
    buildMember({
      id: `member-${SEED_IDS.orgs.acme}-${SEED_IDS.users.user}`,
      organizationId: SEED_IDS.orgs.acme,
      userId: SEED_IDS.users.user,
      role: "admin"
    }),
    buildMember({
      id: `member-${SEED_IDS.orgs.acme}-${SEED_IDS.users.team}`,
      organizationId: SEED_IDS.orgs.acme,
      userId: SEED_IDS.users.team,
      role: "member"
    }),
    buildMember({
      id: `member-${SEED_IDS.orgs.acme}-${SEED_IDS.users.guest}`,
      organizationId: SEED_IDS.orgs.acme,
      userId: SEED_IDS.users.guest,
      role: "member"
    }),
    buildMember({
      id: `member-${SEED_IDS.orgs.demo}-${SEED_IDS.users.user}`,
      organizationId: SEED_IDS.orgs.demo,
      userId: SEED_IDS.users.user,
      role: "owner"
    }),
    buildMember({
      id: `member-${SEED_IDS.orgs.demo}-${SEED_IDS.users.team}`,
      organizationId: SEED_IDS.orgs.demo,
      userId: SEED_IDS.users.team,
      role: "member"
    })
  ]

  await db.insert(member).values(memberships)

  // 4. Platform admin
  await db.insert(platform_admin).values(buildPlatformAdmin())

  // 5. Stripe plan (for billing context)
  await db.insert(stripePlan).values(buildStripePlan())

  // 6. Projects
  const floorPlan = buildProject({
    id: SEED_IDS.projects.floorPlan,
    name: "Office Floor Plan",
    description: "Main office building floor plan with measurements",
    createdBy: SEED_IDS.users.user,
    organizationId: SEED_IDS.orgs.acme
  })

  const sitePlan = buildProject({
    id: SEED_IDS.projects.sitePlan,
    name: "Construction Site Plan",
    description: "Full site layout with building footprints",
    createdBy: SEED_IDS.users.admin,
    organizationId: SEED_IDS.orgs.acme
  })

  const electrical = buildProject({
    id: SEED_IDS.projects.electrical,
    name: "Electrical Layout",
    description: "Electrical wiring and outlet placement",
    createdBy: SEED_IDS.users.user,
    organizationId: SEED_IDS.orgs.demo
  })

  await db.insert(project).values([floorPlan, sitePlan, electrical])

  // 7. Project files
  const files = [
    buildProjectFile({
      id: SEED_IDS.files.floorPlanFile,
      projectId: SEED_IDS.projects.floorPlan,
      pdfUrl: "https://example.com/demo/floor-plan.pdf",
      pdfFileName: "floor-plan.pdf",
      pdfFileSize: 2500000,
      pageCount: 3,
      uploadedBy: SEED_IDS.users.user
    }),
    buildProjectFile({
      id: SEED_IDS.files.sitePlanFile,
      projectId: SEED_IDS.projects.sitePlan,
      pdfUrl: "https://example.com/demo/site-plan.pdf",
      pdfFileName: "site-plan.pdf",
      pdfFileSize: 5000000,
      pageCount: 8,
      uploadedBy: SEED_IDS.users.admin
    }),
    buildProjectFile({
      id: SEED_IDS.files.sitePlanRevision,
      projectId: SEED_IDS.projects.sitePlan,
      pdfUrl: "https://example.com/demo/site-plan-v2.pdf",
      pdfFileName: "site-plan-v2.pdf",
      pdfFileSize: 5200000,
      pageCount: 10,
      uploadedBy: SEED_IDS.users.admin
    }),
    buildProjectFile({
      id: SEED_IDS.files.electricalFile,
      projectId: SEED_IDS.projects.electrical,
      pdfUrl: "https://example.com/demo/electrical.pdf",
      pdfFileName: "electrical.pdf",
      pdfFileSize: 1800000,
      pageCount: 2,
      uploadedBy: SEED_IDS.users.user
    })
  ]

  await db.insert(projectFile).values(files)

  // 8. Shares
  const publicShareData = buildShare({
    id: SEED_IDS.shares.publicShare,
    projectId: SEED_IDS.projects.floorPlan,
    token: "demo-public-share-token",
    createdBy: SEED_IDS.users.user,
    name: "Public Share - Floor Plan",
    shareType: "public",
    message: "Check out our office floor plan!",
    allowDownload: true,
    allowNotes: false
  })

  const privateShareData = buildShare({
    id: SEED_IDS.shares.privateShare,
    projectId: SEED_IDS.projects.sitePlan,
    token: "demo-private-share-token",
    createdBy: SEED_IDS.users.admin,
    name: "Private Share - Site Plan",
    shareType: "private",
    message: "Here's the site plan for review.",
    allowDownload: false,
    allowNotes: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  })

  await db.insert(projectShare).values([publicShareData, privateShareData])

  // 9. Share recipients
  const recipients = [
    buildShareRecipient({
      id: SEED_IDS.recipients.guestRecipient,
      shareId: SEED_IDS.shares.privateShare,
      email: "guest@example.com",
      status: "pending",
      userId: SEED_IDS.users.guest
    }),
    buildShareRecipient({
      id: SEED_IDS.recipients.externalRecipient,
      shareId: SEED_IDS.shares.privateShare,
      email: "external@contractor.com",
      status: "pending",
      userId: null
    })
  ]

  await db.insert(projectShareRecipient).values(recipients)

  return {
    users: {
      admin: { id: SEED_IDS.users.admin, email: "owner@platform.com" },
      regularUser: { id: SEED_IDS.users.user, email: "user@example.com" },
      teamMember: { id: SEED_IDS.users.team, email: "team@example.com" },
      guest: { id: SEED_IDS.users.guest, email: "guest@example.com" }
    },
    orgs: {
      acme: { id: SEED_IDS.orgs.acme, name: "Acme Construction", slug: "acme-construction" },
      demo: { id: SEED_IDS.orgs.demo, name: "Demo Corp", slug: "demo-corp" }
    },
    projects: {
      floorPlan: { id: SEED_IDS.projects.floorPlan, name: "Office Floor Plan" },
      sitePlan: { id: SEED_IDS.projects.sitePlan, name: "Construction Site Plan" },
      electrical: { id: SEED_IDS.projects.electrical, name: "Electrical Layout" }
    },
    files: {
      floorPlanFile: { id: SEED_IDS.files.floorPlanFile },
      sitePlanFile: { id: SEED_IDS.files.sitePlanFile },
      sitePlanRevision: { id: SEED_IDS.files.sitePlanRevision },
      electricalFile: { id: SEED_IDS.files.electricalFile }
    },
    shares: {
      publicShare: { id: SEED_IDS.shares.publicShare, token: "demo-public-share-token" },
      privateShare: { id: SEED_IDS.shares.privateShare, token: "demo-private-share-token" }
    },
    password: DEFAULT_PASSWORD
  }
}
