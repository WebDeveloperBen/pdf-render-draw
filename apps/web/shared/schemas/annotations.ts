import { z } from "zod"

export const pointSchema = z.object({
  x: z.number(),
  y: z.number()
})

export const perimeterSegmentSchema = z.object({
  start: pointSchema,
  end: pointSchema,
  length: z.number(),
  midpoint: pointSchema
})

const baseAnnotationSchema = z.object({
  id: z.string().uuid(),
  pageNum: z.number().int().min(1),
  rotation: z.number(),
  labelScale: z.number().optional()
})

export const measurementAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("measure"),
  points: z.tuple([pointSchema, pointSchema]),
  distance: z.number(),
  midpoint: pointSchema,
  labelRotation: z.number()
})

export const areaAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("area"),
  points: z.array(pointSchema),
  area: z.number(),
  center: pointSchema,
  labelRotation: z.number()
})

export const perimeterAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("perimeter"),
  points: z.array(pointSchema),
  segments: z.array(perimeterSegmentSchema),
  totalLength: z.number(),
  center: pointSchema,
  labelRotation: z.number()
})

export const lineAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("line"),
  points: z.array(pointSchema)
})

export const fillAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("fill"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  opacity: z.number()
})

export const textAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("text"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  content: z.string(),
  fontSize: z.number(),
  color: z.string()
})

export const countAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal("count"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  number: z.number(),
  label: z.string().nullable().optional()
})

export const annotationSchema = z.discriminatedUnion("type", [
  measurementAnnotationSchema,
  areaAnnotationSchema,
  perimeterAnnotationSchema,
  lineAnnotationSchema,
  fillAnnotationSchema,
  textAnnotationSchema,
  countAnnotationSchema
])

export const serverAnnotationSchema = z.discriminatedUnion("type", [
  measurementAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  }),
  areaAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  }),
  perimeterAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  }),
  lineAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  }),
  fillAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  }),
  textAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  }),
  countAnnotationSchema.extend({
    version: z.number().int().min(0),
    deletedAt: z.string().datetime().nullable()
  })
])

export const viewportStateSchema = z.object({
  scale: z.number(),
  rotation: z.number(),
  scrollLeft: z.number(),
  scrollTop: z.number(),
  currentPage: z.number().int().min(1)
})

export const annotationsResponseSchema = z.object({
  annotations: z.array(serverAnnotationSchema),
  meta: z.object({
    count: z.number(),
    lastModified: z.string().datetime().nullable(),
    serverTime: z.string().datetime()
  }),
  viewportState: viewportStateSchema.nullable().optional()
})

export const syncOperationTypeSchema = z.enum(["create", "update", "delete"])

export const syncOperationSchema = z.object({
  type: syncOperationTypeSchema,
  annotation: annotationSchema,
  localVersion: z.number().int().min(0),
  timestamp: z.string().datetime()
})

export const syncRequestSchema = z.object({
  clientTime: z.string().datetime(),
  lastSyncTime: z.string().datetime().optional(),
  operations: z.array(syncOperationSchema).max(100),
  viewportState: viewportStateSchema.optional()
})

export const syncConflictSchema = z.object({
  annotationId: z.string(),
  reason: z.enum(["version_mismatch", "deleted", "validation_error"]),
  serverVersion: serverAnnotationSchema.nullable(),
  message: z.string().optional()
})

export const syncResponseSchema = z.object({
  success: z.boolean(),
  applied: z.array(z.string()),
  conflicts: z.array(syncConflictSchema),
  serverUpdates: z.array(serverAnnotationSchema),
  meta: z.object({
    serverTime: z.string().datetime(),
    syncId: z.string()
  }),
  viewportState: viewportStateSchema.nullable().optional()
})
