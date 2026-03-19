import type { InferInsertModel } from "drizzle-orm"
import type { platform_admin } from "../../../shared/db/schema"
import { SEED_IDS } from "./users"

type PlatformAdminInsert = InferInsertModel<typeof platform_admin>

export function buildPlatformAdmin(overrides: Partial<PlatformAdminInsert> = {}): PlatformAdminInsert {
  return {
    id: `${SEED_IDS.users.admin}-platform-admin`,
    userId: SEED_IDS.users.admin,
    tier: "owner",
    grantedBy: null,
    grantedAt: new Date(),
    notes: "Seeded platform owner for testing",
    ...overrides
  }
}
