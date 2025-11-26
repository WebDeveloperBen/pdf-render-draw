import type { Point } from './index'

// Tool types
export type ToolType = 'measure' | 'area' | 'perimeter' | 'line' | 'fill' | 'text' | 'count'

// Base annotation type
export interface BaseAnnotation {
  id: string
  type: ToolType
  pageNum: number
  rotation: number // Required for all annotations (in radians) - enables group transforms
  createdAt?: string
  updatedAt?: string

  // Temporary transform metadata (not persisted, used during group transformations)
  _groupCenter?: Point // Group center position during multi-select rotation drag
  _originalCenter?: Point // Original center position before transformation (for visual debugging)
}

// Specific annotation types
export interface Measurement extends BaseAnnotation {
  type: 'measure'
  points: [Point, Point] // Always exactly 2 points
  distance: number
  midpoint: Point
  labelRotation: number // Label rotation in degrees, baked in at creation time to appear upright in viewport
  // rotation inherited from BaseAnnotation
}

export interface Area extends BaseAnnotation {
  type: 'area'
  points: Point[] // Min 3 points
  area: number // in m²
  center: Point
  labelRotation: number // Label rotation in degrees, baked in at creation time to appear upright in viewport
  // rotation inherited from BaseAnnotation
}

export interface PerimeterSegment {
  start: Point
  end: Point
  length: number
  midpoint: Point
}

export interface Perimeter extends BaseAnnotation {
  type: 'perimeter'
  points: Point[] // Min 3 points
  segments: PerimeterSegment[]
  totalLength: number
  center: Point
  labelRotation: number // Label rotation in degrees, baked in at creation time to appear upright in viewport
  // rotation inherited from BaseAnnotation
}

export interface Line extends BaseAnnotation {
  type: 'line'
  points: Point[] // Min 2 points
  // rotation inherited from BaseAnnotation
}

export interface Fill extends BaseAnnotation {
  type: 'fill'
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  // rotation, _groupCenter, _originalCenter inherited from BaseAnnotation
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number // Top-left corner X (consistent with other positioned annotations)
  y: number // Top-left corner Y (consistent with other positioned annotations)
  width: number
  height: number
  content: string
  fontSize: number
  color: string
  // rotation, _groupCenter, _originalCenter inherited from BaseAnnotation (in radians)
}

export interface Count extends BaseAnnotation {
  type: 'count'
  x: number
  y: number
  width: number // Bounding box width (for selection/transform)
  height: number // Bounding box height (for selection/transform)
  number: number // The count number (1, 2, 3...)
  label?: string // Optional custom label
  // rotation inherited from BaseAnnotation
}

// Union type for all annotations
export type Annotation =
  | Measurement
  | Area
  | Perimeter
  | Line
  | Fill
  | TextAnnotation
  | Count

// Type guards
export function isMeasurement(ann: Annotation): ann is Measurement {
  return ann.type === 'measure'
}

export function isArea(ann: Annotation): ann is Area {
  return ann.type === 'area'
}

export function isPerimeter(ann: Annotation): ann is Perimeter {
  return ann.type === 'perimeter'
}

export function isLine(ann: Annotation): ann is Line {
  return ann.type === 'line'
}

export function isFill(ann: Annotation): ann is Fill {
  return ann.type === 'fill'
}

export function isText(ann: Annotation): ann is TextAnnotation {
  return ann.type === 'text'
}

export function isCount(ann: Annotation): ann is Count {
  return ann.type === 'count'
}

/**
 * Runtime validation functions
 * These check data integrity beyond just type checking
 */

export function isValidPoint(point: unknown): point is Point {
  return (
    typeof point === 'object' &&
    point !== null &&
    'x' in point &&
    'y' in point &&
    typeof (point as Point).x === 'number' &&
    typeof (point as Point).y === 'number' &&
    !isNaN((point as Point).x) &&
    !isNaN((point as Point).y)
  )
}

/**
 * Generic shape-based validation for annotations
 * Validates based on data structure rather than specific tool types
 * This allows tools to be decoupled from the validation logic
 */
export function validateAnnotation(ann: unknown): ann is Annotation {
  if (typeof ann !== 'object' || ann === null) return false

  const obj = ann as Record<string, unknown>

  // Validate base properties (required for all annotations)
  if (!obj.id || typeof obj.id !== 'string') return false
  if (!obj.type || typeof obj.type !== 'string') return false
  if (typeof obj.pageNum !== 'number' || obj.pageNum < 1) return false

  // Shape-based validation: validate properties based on their presence
  // This makes validation tool-agnostic

  // Points array (for point-based annotations)
  if ('points' in obj) {
    if (!Array.isArray(obj.points)) return false
    if (obj.points.length < 2) return false
    if (!obj.points.every(isValidPoint)) return false
  }

  // Segments array (for perimeter-like annotations)
  if ('segments' in obj) {
    if (!Array.isArray(obj.segments)) return false
  }

  // Numeric measurement values
  if ('distance' in obj && (typeof obj.distance !== 'number' || obj.distance < 0 || isNaN(obj.distance))) return false
  if ('area' in obj && (typeof obj.area !== 'number' || obj.area < 0 || isNaN(obj.area))) return false
  if ('totalLength' in obj && (typeof obj.totalLength !== 'number' || obj.totalLength < 0 || isNaN(obj.totalLength))) return false

  // Point properties (center, midpoint)
  if ('center' in obj && !isValidPoint(obj.center)) return false
  if ('midpoint' in obj && !isValidPoint(obj.midpoint)) return false

  // Rotation values (should be numbers, can be any value including negative)
  if ('rotation' in obj && (typeof obj.rotation !== 'number' || isNaN(obj.rotation))) return false
  if ('labelRotation' in obj && (typeof obj.labelRotation !== 'number' || isNaN(obj.labelRotation))) return false

  // Positioned rectangle properties
  if ('x' in obj && (typeof obj.x !== 'number' || isNaN(obj.x))) return false
  if ('y' in obj && (typeof obj.y !== 'number' || isNaN(obj.y))) return false
  if ('width' in obj && (typeof obj.width !== 'number' || isNaN(obj.width))) return false
  if ('height' in obj && (typeof obj.height !== 'number' || isNaN(obj.height))) return false

  // Color and opacity
  if ('color' in obj && typeof obj.color !== 'string') return false
  if ('opacity' in obj && (typeof obj.opacity !== 'number' || obj.opacity < 0 || obj.opacity > 1)) return false

  // Text-specific
  if ('content' in obj && typeof obj.content !== 'string') return false
  if ('fontSize' in obj && (typeof obj.fontSize !== 'number' || obj.fontSize <= 0)) return false

  // Count-specific
  if ('number' in obj && (typeof obj.number !== 'number' || obj.number <= 0)) return false
  if ('label' in obj && obj.label !== undefined && typeof obj.label !== 'string') return false

  return true
}
