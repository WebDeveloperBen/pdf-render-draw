import { hashPassword } from "better-auth/crypto"
import type { InferInsertModel } from "drizzle-orm"
import type { user, account } from "../../../shared/db/schema"

type UserInsert = InferInsertModel<typeof user>
type AccountInsert = InferInsertModel<typeof account>

export const SEED_IDS = {
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
  },
  recipients: {
    guestRecipient: "00000000-0000-4000-8000-000000000040",
    externalRecipient: "00000000-0000-4000-8000-000000000041"
  }
}

export const DEFAULT_PASSWORD = "password123"

export function buildUser(overrides: Partial<UserInsert> = {}): UserInsert {
  return {
    id: SEED_IDS.users.user,
    email: "user@example.com",
    name: "Demo User",
    firstName: "Demo",
    lastName: "User",
    emailVerified: true,
    isGuest: false,
    role: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export async function buildUserWithAccount(
  userOverrides: Partial<UserInsert> = {},
  password: string = DEFAULT_PASSWORD
): Promise<{ user: UserInsert; account: AccountInsert }> {
  const u = buildUser(userOverrides)
  const passwordHash = await hashPassword(password)

  const acc: AccountInsert = {
    id: `${u.id}-credential`,
    accountId: u.id!,
    providerId: "credential",
    userId: u.id!,
    password: passwordHash,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  return { user: u, account: acc }
}
