/**
 * Room detection types
 *
 * Represents enclosed regions (rooms) detected from PDF vector geometry.
 * Rooms are minimal closed polygons found by traversing the planar graph
 * of line segments extracted from the PDF.
 */

import type { Segment } from "@/types/snap"

export interface DetectedRoom {
  /** Unique identifier */
  id: string
  /** Ordered polygon vertices (closed — last point connects back to first) */
  polygon: Point[]
  /** Area in PDF square points */
  area: number
  /** Centroid of the polygon */
  centroid: Point
  /** Axis-aligned bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  /** Room label from OCR or text extraction (e.g. "Bed 3", "Kitchen") */
  label?: string | null
  /** Detection confidence 0-1 (from OCR provider) */
  confidence?: number | null
}

export interface RoomDetectionResult {
  /** All detected rooms for a page */
  rooms: DetectedRoom[]
  /** Number of graph nodes (merged endpoints) */
  nodeCount: number
  /** Number of graph edges (segments) */
  edgeCount: number
  /** Optional debug geometry used by the raw overlay layer */
  debug?: RoomDetectionDebug | null
}

export interface RoomDetectionDebug {
  /** Raw straight-line segments extracted from PDF path ops */
  rawSegments: Segment[]
  /** Wall-like segments after length/bounds filtering */
  wallSegments: Segment[]
  /** Segments after intersection splitting and short-segment pruning */
  graphSegments: Segment[]
  /** Graph nodes (merged endpoints) */
  nodes: Point[]
  /** Graph edges (deduplicated undirected edges) */
  edges: Segment[]
  /** Number of extracted raw faces before room filtering */
  faceCount: number
}
