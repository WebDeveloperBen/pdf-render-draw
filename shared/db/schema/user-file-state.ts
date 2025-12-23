import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, real, primaryKey } from "drizzle-orm/pg-core"
import { user } from "./better-auth"
import { projectFile } from "./project-file"

/**
 * User File State table - stores per-user viewport preferences for each file
 * This allows each user to have their own zoom, rotation, scroll position, and current page
 */
export const userFileState = pgTable(
  "user_file_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => projectFile.id, { onDelete: "cascade" }),

    // Viewport state
    viewportScale: real("viewport_scale").default(1).notNull(),
    viewportRotation: integer("viewport_rotation").default(0).notNull(),
    viewportScrollLeft: real("viewport_scroll_left").default(0).notNull(),
    viewportScrollTop: real("viewport_scroll_top").default(0).notNull(),
    viewportCurrentPage: integer("viewport_current_page").default(1).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.fileId] })]
)

export const userFileStateRelations = relations(userFileState, ({ one }) => ({
  user: one(user, {
    fields: [userFileState.userId],
    references: [user.id]
  }),
  file: one(projectFile, {
    fields: [userFileState.fileId],
    references: [projectFile.id]
  })
}))
