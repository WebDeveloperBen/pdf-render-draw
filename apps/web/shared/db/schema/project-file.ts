import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core"
import { user } from "./better-auth"
import { project } from "./projects"

/**
 * Project File table - stores individual PDF files within a project
 * Projects can have multiple files (1:N relationship)
 *
 * Note: Viewport state (scale, rotation, scroll, page) is stored per-user
 * in the user_file_state table to support collaborative editing where
 * each user has their own view of the document.
 */
export const projectFile = pgTable(
  "project_file",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    // File metadata
    pdfUrl: text("pdf_url").notNull(),
    pdfFileName: text("pdf_file_name").notNull(),
    pdfFileSize: integer("pdf_file_size").notNull(),
    pageCount: integer("page_count").default(0).notNull(),
    annotationCount: integer("annotation_count").default(0).notNull(),

    // Tracking
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("projectFile_projectId_idx").on(table.projectId),
    index("projectFile_createdAt_idx").on(table.projectId, table.createdAt),
    index("projectFile_uploadedBy_idx").on(table.uploadedBy)
  ]
)

export const projectFileRelations = relations(projectFile, ({ one }) => ({
  project: one(project, {
    fields: [projectFile.projectId],
    references: [project.id]
  }),
  uploader: one(user, {
    fields: [projectFile.uploadedBy],
    references: [user.id]
  })
}))
