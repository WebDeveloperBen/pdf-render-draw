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
}

export interface Area extends BaseAnnotation {
  type: 'area'
  points: Point[] // Min 3 points
  area: number // in m²
  center: Point
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
}

export interface Line extends BaseAnnotation {
  type: 'line'
  points: Point[] // Min 2 points
}

export interface Fill extends BaseAnnotation {
  type: 'fill'
  x: number
  y: number
  color: string
  opacity: number
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
