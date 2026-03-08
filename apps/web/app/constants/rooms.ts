/**
 * Room detection constants
 *
 * Tunable values for the room detection algorithm.
 * Optimised for building plans (floor plans, architectural drawings).
 */

export const ROOMS = {
  // --- Segment filtering ---

  /** Minimum segment length to qualify as a wall (PDF points).
   *  Walls are long — this filters text, dimension ticks, symbols.
   *  At 72 DPI: 10pt ≈ 3.5mm at 1:1. Kept moderate since intersection
   *  splitting will create shorter sub-segments from long walls. */
  MIN_WALL_LENGTH: 10,
  WALL_ORTHOGONAL_TOLERANCE_DEG: 15,

  // --- Graph construction ---

  /** Tolerance for merging nearby endpoints into a single graph node (PDF points).
   *  Building plans often have small gaps between walls at junctions.
   *  Larger = more forgiving but may merge distinct points. */
  NODE_MERGE_TOLERANCE: 4,

  // --- Room filtering ---

  /** Minimum area for a detected room (PDF square points).
   *  At typical plan scale, ~300 sq pts filters tiny artifacts. */
  MIN_AREA: 300,

  /** Minimum room area as a fraction of page area.
   *  Keeps area filtering scale-aware across different page sizes. */
  MIN_AREA_RATIO: 0.0003,

  /** Maximum area as a fraction of total page area.
   *  Filters exterior face and overly large polygons. */
  MAX_AREA_RATIO: 0.4,

  /** Minimum number of edges in a room polygon */
  MIN_EDGES: 3,

  /** Maximum number of edges in a room polygon */
  MAX_EDGES: 30,

  /** Minimum room dimension — both width AND height must exceed this (PDF points).
   *  Raised to reject title block rows/columns that often form small closed cells.
   *  At 72 DPI: 20pt ≈ 7mm. */
  MIN_ROOM_DIMENSION: 20,

  /** Reject polygons that touch within this margin of the page edge (PDF points).
   *  Border/title artefacts commonly form tiny closed loops near page edges. */
  PAGE_EDGE_MARGIN: 8,
  PAGE_EDGE_MARGIN_RATIO: 0.05,

  /** Orthogonality filters keep room-like polygons and reject roof/detail wedges. */
  ORTHOGONAL_TOLERANCE_DEG: 12,
  MIN_ORTHOGONAL_EDGE_RATIO: 0.6,

  // --- Rectangle fallback detection ---
  RECT_LINE_ALIGN_TOLERANCE: 2,
  RECT_MIN_SIDE: 20,
  RECT_SIDE_COVERAGE_RATIO: 0.45,
  RECT_MAX_CANDIDATE_LINES: 24,
  RECT_DEDUP_IOU: 0.9,

  // --- Large-document component filtering ---
  COMPONENT_FILTER_MIN_NODES: 80,
  COMPONENT_MIN_EDGES: 20,

  /** Minimum compactness ratio (4π × area / perimeter²).
   *  Square ≈ 0.785. Lowered to 0.05 to allow L-shaped rooms. */
  MIN_COMPACTNESS: 0.05,

  /** Minimum segment length to include from raw input (PDF points) */
  MIN_SEGMENT_LENGTH: 3,

  // --- Rendering ---

  FILL_COLOR: "hsl(210, 80%, 60%)",
  FILL_OPACITY: 0.2,
  STROKE_COLOR: "hsl(210, 80%, 50%)",
  STROKE_OPACITY: 0.7,
  STROKE_WIDTH_PX: 1.5
} as const
