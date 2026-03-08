/**
 * Snap system types
 *
 * Defines the snap target types, sources, and results used by the
 * snap provider and all drawing tools.
 */

export type SnapTargetType =
  | "endpoint"
  | "intersection"
  | "midpoint"
  | "nearest-on-edge"

export type SnapSource = "markup" | "content"

export interface SnapTarget {
  point: Point
  type: SnapTargetType
  source: SnapSource
  /** Lower = preferred when equidistant. Endpoints beat midpoints beat edge snaps. */
  priority: number
}

export interface SnapResult {
  /** Whether the point was snapped */
  snapped: boolean
  /** The final point (snapped or original cursor position) */
  point: Point
  /** Snap details when snapped, null otherwise */
  info: SnapInfo | null
}

export interface SnapInfo {
  point: Point
  type: SnapTargetType
  source: SnapSource
  label: string
}

export interface Segment {
  start: Point
  end: Point
}
