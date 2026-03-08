import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, index, jsonb } from "drizzle-orm/pg-core"
import { user, organization } from "./better-auth"
import { projectShare } from "./project-share"
import { projectFile } from "./project-file"

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    // Reference / Job number
    reference: text("reference"),
    // Project category (new-build, renovation, etc.)
    category: text("category"),
    // Job site location
    siteAddress: text("site_address"),
    suburb: text("suburb"),
    postcode: text("postcode"),
    // Client information
    clientName: text("client_name"),
    clientEmail: text("client_email"),
    clientPhone: text("client_phone"),
    // Priority and organisation
    priority: text("priority").default("normal").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    notes: text("notes"),
    // Deprecated: PDF fields moved to project_file table
    // Kept nullable for migration transition, will be removed
    pdfUrl: text("pdf_url"),
    pdfFileName: text("pdf_file_name"),
    pdfFileSize: integer("pdf_file_size"),
    thumbnailUrl: text("thumbnail_url"),
    pageCount: integer("page_count").default(0),
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
  shares: many(projectShare),
  files: many(projectFile)
}))
