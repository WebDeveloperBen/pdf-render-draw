import type { InferInsertModel } from "drizzle-orm"
import type { projectShare, projectShareRecipient } from "../../../shared/db/schema"
import { SEED_IDS } from "./users"

type ShareInsert = InferInsertModel<typeof projectShare>
type RecipientInsert = InferInsertModel<typeof projectShareRecipient>

export function buildShare(overrides: Partial<ShareInsert> = {}): ShareInsert {
  return {
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
    expiresAt: null,
    viewCount: 0,
    lastViewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

export function buildShareRecipient(overrides: Partial<RecipientInsert> = {}): RecipientInsert {
  return {
    id: SEED_IDS.recipients.guestRecipient,
    shareId: SEED_IDS.shares.privateShare,
    email: "guest@example.com",
    status: "pending",
    userId: null,
    viewCount: 0,
    invitedAt: new Date(),
    firstViewedAt: null,
    lastViewedAt: null,
    ...overrides
  }
}
