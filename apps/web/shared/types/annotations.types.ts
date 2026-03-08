import type { InferSelectModel, InferInsertModel } from "drizzle-orm"
import type { annotation } from "../db/schema"

// Re-export annotation types from app (these are the client-side types)
// Note: We duplicate the core types here for server-side usage
// This avoids circular dependencies between app and shared

// Tool types
export type ToolType = "measure" | "area" | "perimeter" | "line" | "fill" | "text" | "count"

// Point type (used in annotations)
export interface Point {
  x: number
  y: number
}

// Base annotation type
export interface BaseAnnotation {
  id: string
  type: ToolType
  pageNum: number
  rotation: number
  labelScale?: number // Inverse viewport scale at creation time — stamps labels at visual size
  createdAt?: string
  updatedAt?: string
  _groupCenter?: Point
  _originalCenter?: Point
}

// Specific annotation types
export interface Measurement extends BaseAnnotation {
  type: "measure"
  points: [Point, Point]
  distance: number
  midpoint: Point
  labelRotation: number
}

export interface Area extends BaseAnnotation {
  type: "area"
  points: Point[]
  area: number
  center: Point
  labelRotation: number
}

export interface PerimeterSegment {
  start: Point
  end: Point
  length: number
  midpoint: Point
}

export interface Perimeter extends BaseAnnotation {
  type: "perimeter"
  points: Point[]
  segments: PerimeterSegment[]
  totalLength: number
  center: Point
  labelRotation: number
}

export interface Line extends BaseAnnotation {
  type: "line"
  points: Point[]
}

export interface Fill extends BaseAnnotation {
  type: "fill"
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text"
  x: number
  y: number
  width: number
  height: number
  content: string
  fontSize: number
  color: string
}

export interface Count extends BaseAnnotation {
  type: "count"
  x: number
  y: number
  width: number
  height: number
  number: number
  label?: string
}

// Union type for all annotations
export type Annotation = Measurement | Area | Perimeter | Line | Fill | TextAnnotation | Count

// Database model types (inferred from Drizzle schema)
export type AnnotationRecord = InferSelectModel<typeof annotation>
export type AnnotationInsert = InferInsertModel<typeof annotation>

// Annotation with creator info (for API responses)
export interface AnnotationWithCreator extends AnnotationRecord {
  creator: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

// Sync operation types
export type SyncOperationType = "create" | "update" | "delete"

export interface SyncOperation {
  type: SyncOperationType
  annotation: Annotation
  localVersion: number
  timestamp: string
}

export interface SyncRequest {
  clientTime: string
  lastSyncTime?: string
  operations: SyncOperation[]
}

export interface SyncConflict {
  annotationId: string
  reason: "version_mismatch" | "deleted" | "validation_error"
  serverVersion: Annotation | null
  message?: string
}

export interface SyncResponse {
  success: boolean
  applied: string[]
  conflicts: SyncConflict[]
  serverUpdates: Annotation[]
  meta: {
    serverTime: string
    syncId: string
  }
}

export interface AnnotationsResponse {
  annotations: Annotation[]
  meta: {
    count: number
    lastModified: string | null
    serverTime: string
  }
}
