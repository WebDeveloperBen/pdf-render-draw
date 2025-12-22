import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"
import { session } from "./session"
import { account } from "./account"
import { member } from "./member"
import { teamMember } from "./team-member"
import { apikey } from "./api-key"
import { invitation } from "./invitation"
import { platform_admin } from "./platform-admin"
import { admin_audit_log } from "./admin-audit-log"
import { organization } from "./organisation"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  firstName: text("first_name"),
  lastName: text("last_name"),

  // Guest user fields
  isGuest: boolean("is_guest").default(false).notNull(),
  guestOrganizationId: text("guest_organization_id").references(() => organization.id)
})

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  teamMembers: many(teamMember),
  apiKeys: many(apikey),
  invitations: many(invitation),
  platformAdmins: many(platform_admin, { relationName: "platformAdminUser" }),
  platformAdminsGranted: many(platform_admin, { relationName: "platformAdminGrantedBy" }),
  adminAuditLogs: many(admin_audit_log, { relationName: "auditLogAdmin" })
}))
