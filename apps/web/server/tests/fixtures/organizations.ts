import type { InferInsertModel } from "drizzle-orm"
import type { organization, member } from "../../../shared/db/schema"
import { SEED_IDS } from "./users"

type OrgInsert = InferInsertModel<typeof organization>
type MemberInsert = InferInsertModel<typeof member>

export function buildOrg(overrides: Partial<OrgInsert> = {}): OrgInsert {
  return {
    id: SEED_IDS.orgs.acme,
    name: "Acme Construction",
    slug: "acme-construction",
    logo: null,
    metadata: null,
    stripeCustomerId: null,
    createdAt: new Date(),
    ...overrides
  }
}

export function buildMember(overrides: Partial<MemberInsert> = {}): MemberInsert {
  return {
    id: `member-${overrides.organizationId ?? SEED_IDS.orgs.acme}-${overrides.userId ?? SEED_IDS.users.user}`,
    organizationId: SEED_IDS.orgs.acme,
    userId: SEED_IDS.users.user,
    role: "member",
    createdAt: new Date(),
    ...overrides
  }
}
