import type { Point } from './index'

// Base annotation type
export interface BaseAnnotation {
  id: string
  type: 'measure' | 'area' | 'perimeter' | 'line' | 'fill' | 'text'
  pageNum: number
  createdAt?: string
  updatedAt?: string
}

// Specific annotation types
export interface Measurement extends BaseAnnotation {
  type: 'measure'
  points: [Point, Point] // Always exactly 2 points
  distance: number
  midpoint: Point
  labelRotation: number // Label rotation in degrees, baked in at creation time to appear upright in viewport
  rotation?: number // Shape rotation in radians (default 0)
}

export interface Area extends BaseAnnotation {
  type: 'area'
  points: Point[] // Min 3 points
  area: number // in m²
  center: Point
  labelRotation: number // Label rotation in degrees, baked in at creation time to appear upright in viewport
  rotation?: number // Shape rotation in radians (default 0)
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
  rotation?: number // Shape rotation in radians (default 0)
}

export interface Line extends BaseAnnotation {
  type: 'line'
  points: Point[] // Min 2 points
  rotation?: number // Shape rotation in radians (default 0)
}

export interface Fill extends BaseAnnotation {
  type: 'fill'
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  rotation?: number // Rotation in radians (for group rotation)
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text'
  x: number
  y: number
  width: number
  height: number
  content: string
  fontSize: number
  color: string
  rotation: number // Rotation in degrees, baked in at creation time
}

// Union type for all annotations
export type Annotation =
  | Measurement
  | Area
  | Perimeter
  | Line
  | Fill
  | TextAnnotation

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

export function validateAnnotation(ann: unknown): ann is Annotation {
  if (typeof ann !== 'object' || ann === null) return false

  const base = ann as BaseAnnotation

  // Validate base properties
  if (!base.id || typeof base.id !== 'string') return false
  if (!base.type || typeof base.type !== 'string') return false
  if (typeof base.pageNum !== 'number' || base.pageNum < 1) return false

  // Type-specific validation
  switch (base.type) {
    case 'measure': {
      const m = ann as Measurement
      return (
        Array.isArray(m.points) &&
        m.points.length === 2 &&
        m.points.every(isValidPoint) &&
        typeof m.distance === 'number' &&
        m.distance >= 0 &&
        isValidPoint(m.midpoint) &&
        typeof m.labelRotation === 'number'
      )
    }

    case 'area': {
      const a = ann as Area
      return (
        Array.isArray(a.points) &&
        a.points.length >= 3 &&
        a.points.every(isValidPoint) &&
        typeof a.area === 'number' &&
        a.area >= 0 &&
        isValidPoint(a.center) &&
        typeof a.labelRotation === 'number'
      )
    }

    case 'perimeter': {
      const p = ann as Perimeter
      return (
        Array.isArray(p.points) &&
        p.points.length >= 3 &&
        p.points.every(isValidPoint) &&
        Array.isArray(p.segments) &&
        p.segments.length > 0 &&
        typeof p.totalLength === 'number' &&
        p.totalLength >= 0 &&
        isValidPoint(p.center) &&
        typeof p.labelRotation === 'number'
      )
    }

    case 'line': {
      const l = ann as Line
      return (
        Array.isArray(l.points) &&
        l.points.length >= 2 &&
        l.points.every(isValidPoint)
      )
    }

    case 'fill': {
      const f = ann as Fill
      return (
        typeof f.x === 'number' &&
        typeof f.y === 'number' &&
        typeof f.color === 'string' &&
        typeof f.opacity === 'number' &&
        f.opacity >= 0 &&
        f.opacity <= 1
      )
    }

    case 'text': {
      const t = ann as TextAnnotation
      return (
        typeof t.x === 'number' &&
        typeof t.y === 'number' &&
        typeof t.width === 'number' &&
        typeof t.height === 'number' &&
        typeof t.content === 'string' &&
        typeof t.fontSize === 'number' &&
        t.fontSize > 0 &&
        typeof t.color === 'string' &&
        typeof t.rotation === 'number'
      )
    }

    default:
      return false
  }
}
