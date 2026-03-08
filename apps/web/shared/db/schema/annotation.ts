import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, integer, index, jsonb } from "drizzle-orm/pg-core"
import { user } from "./better-auth"
import { project } from "./projects"
import { projectFile } from "./project-file"

/**
 * Annotation table - stores individual annotations within a project file
 * Each annotation belongs to a specific file (1:N relationship)
 *
 * CRDT-ready design:
 * - Client-generated UUIDs for IDs
 * - Version field for optimistic locking (future: vector clocks)
 * - Soft delete via deletedAt (tombstones)
 * - JSONB data field for flexible annotation storage
 */
export const annotation = pgTable(
  "annotation",
  {
    id: text("id").primaryKey(), // Client-generated UUID
    fileId: text("file_id")
      .notNull()
      .references(() => projectFile.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    // Annotation metadata (denormalised for queries)
    type: text("type").notNull(), // measure, area, perimeter, line, fill, text, count
    pageNum: integer("page_num").notNull(),

    // Full annotation data as JSONB
    // Stores the complete annotation object for flexibility
    // Type safety provided by annotations.types.ts AnnotationRecord type
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),

    // Authorship
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "set null" }),
    modifiedBy: text("modified_by").references(() => user.id, { onDelete: "set null" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),

    // Soft delete for CRDT tombstones and recovery
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // Version tracking for optimistic locking and future CRDT
    version: integer("version").default(1).notNull()
  },
  (table) => [
    index("annotation_file_id_idx").on(table.fileId),
    index("annotation_project_id_idx").on(table.projectId),
    index("annotation_file_page_idx").on(table.fileId, table.pageNum),
    index("annotation_updated_at_idx").on(table.fileId, table.updatedAt),
    index("annotation_created_by_idx").on(table.createdBy)
  ]
)

export const annotationRelations = relations(annotation, ({ one }) => ({
  file: one(projectFile, {
    fields: [annotation.fileId],
    references: [projectFile.id]
  }),
  project: one(project, {
    fields: [annotation.projectId],
    references: [project.id]
  }),
  creator: one(user, {
    fields: [annotation.createdBy],
    references: [user.id],
    relationName: "annotationCreator"
  }),
  modifier: one(user, {
    fields: [annotation.modifiedBy],
    references: [user.id],
    relationName: "annotationModifier"
  })
}))
