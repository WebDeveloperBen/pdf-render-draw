import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core"
import { user, organization } from "./better-auth"
import { projectShare } from "./project-share"

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    pdfUrl: text("pdf_url").notNull(),
    pdfFileName: text("pdf_file_name").notNull(),
    pdfFileSize: integer("pdf_file_size").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    pageCount: integer("page_count").default(0).notNull(),
    annotationCount: integer("annotation_count").default(0).notNull(),
    lastViewedAt: timestamp("last_viewed_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("project_createdBy_idx").on(table.createdBy),
    index("project_organizationId_idx").on(table.organizationId),
    index("project_createdAt_idx").on(table.createdAt)
  ]
)

export const projectRelations = relations(project, ({ one, many }) => ({
  creator: one(user, {
    fields: [project.createdBy],
    references: [user.id]
  }),
  organization: one(organization, {
    fields: [project.organizationId],
    references: [organization.id]
  }),
  shares: many(projectShare)
}))
