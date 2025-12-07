import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core"
import { user, organization } from "./better-auth"

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
    expiresAt: timestamp("expires_at"),
    password: text("password"),
    allowDownload: boolean("allow_download").default(true).notNull(),
    allowAnnotations: boolean("allow_annotations").default(false).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    lastViewedAt: timestamp("last_viewed_at"),
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

export const projectShareRelations = relations(projectShare, ({ one }) => ({
  project: one(project, {
    fields: [projectShare.projectId],
    references: [project.id]
  }),
  creator: one(user, {
    fields: [projectShare.createdBy],
    references: [user.id]
  })
}))
