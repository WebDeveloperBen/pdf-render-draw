import { relations } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  jsonb,
  boolean,
  doublePrecision
} from "drizzle-orm/pg-core"
import { user } from "./better-auth"
import { project } from "./projects"
import { projectFile } from "./project-file"

export interface RoomPoint {
  x: number
  y: number
}

export interface RoomBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Persisted detected room overlays.
 *
 * This supports pre-processing flows where room detection is done ahead of time
 * and rendered instantly when users open plans.
 */
export const detectedRoom = pgTable(
  "detected_room",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => projectFile.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    pageNum: integer("page_num").notNull(),

    polygon: jsonb("polygon").$type<RoomPoint[]>().notNull(),
    bounds: jsonb("bounds").$type<RoomBounds>().notNull(),
    area: doublePrecision("area").notNull(),
    centroidX: doublePrecision("centroid_x").notNull(),
    centroidY: doublePrecision("centroid_y").notNull(),

    roomLabel: text("room_label"),
    confidence: doublePrecision("confidence"),
    source: text("source").default("poc-client").notNull(),
    visible: boolean("visible").default(true).notNull(),

    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("detected_room_file_page_idx").on(table.fileId, table.pageNum),
    index("detected_room_file_page_visible_idx").on(table.fileId, table.pageNum, table.visible),
    index("detected_room_project_idx").on(table.projectId)
  ]
)

export const detectedRoomRelations = relations(detectedRoom, ({ one }) => ({
  file: one(projectFile, {
    fields: [detectedRoom.fileId],
    references: [projectFile.id]
  }),
  project: one(project, {
    fields: [detectedRoom.projectId],
    references: [project.id]
  }),
  creator: one(user, {
    fields: [detectedRoom.createdBy],
    references: [user.id]
  })
}))
