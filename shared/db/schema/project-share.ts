import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core"
import { user } from "./better-auth"
import { project } from "./projects"

export const projectShare = pgTable(
  "project_share",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Share metadata
    name: text("name"),
    shareType: text("share_type").notNull().default("public"), // 'public' | 'private'
    message: text("message"),

    // Access settings
    expiresAt: timestamp("expires_at"),
    password: text("password"),
    allowDownload: boolean("allow_download").default(true).notNull(),
    allowNotes: boolean("allow_notes").default(false).notNull(),

    // Analytics
    viewCount: integer("view_count").default(0).notNull(),
    lastViewedAt: timestamp("last_viewed_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("projectShare_projectId_idx").on(table.projectId),
    index("projectShare_token_idx").on(table.token),
    index("projectShare_createdBy_idx").on(table.createdBy)
  ]
)

export const projectShareRelations = relations(projectShare, ({ one }) => ({
  project: one(project, {
    fields: [projectShare.projectId],
    references: [project.id]
  }),
  creator: one(user, {
    fields: [projectShare.createdBy],
    references: [user.id]
  })
  // Note: recipients relation defined in project-share-recipient.ts to avoid circular import
}))
