/**
 * Snap system constants
 *
 * All tunable values for the snap engine in one place.
 */

export const SNAP = {
  /** Default snap distance threshold in screen pixels (converted to PDF points at runtime) */
  DISTANCE_PX: 16,

  /** Edge snap gets a larger catch radius (multiplier on DISTANCE_PX) */
  EDGE_DISTANCE_MULTIPLIER: 1.5,

  /** Spatial grid cell size for fast nearest-neighbor lookup (PDF points) */
  GRID_CELL_SIZE: 40,

  // --- PDF content extraction ---

  /** Minimum segment length for edge snapping (keeps fine detail for "on edge" snap) */
  MIN_SEGMENT_LENGTH: 3,

  /** Minimum segment length for point targets — endpoints/midpoints (filters text glyphs and hatching noise) */
  MIN_SEGMENT_LENGTH_POINTS: 15,

  /** Dedup tolerance for extracted endpoints (PDF points) */
  ENDPOINT_DEDUP_TOLERANCE: 0.5,

  /** Dedup tolerance for computed intersections (PDF points) */
  INTERSECTION_DEDUP_TOLERANCE: 1,

  /** Reject near-parallel segment pairs (degrees) */
  NEAR_PARALLEL_DEG: 3,

  /** Spatial grid cell for intersection acceleration (PDF points) */
  INTERSECTION_GRID_CELL: 50,

  /** Density cap — discard cells with more intersections than this (hatching filter) */
  DENSITY_CELL_SIZE: 20,
  DENSITY_CAP: 15,

  /** Cell size for segment spatial grid used in edge snapping (PDF points) */
  SEGMENT_GRID_CELL: 50,

  /** Cell size for deduplication spatial hash (PDF points) */
  DEDUP_CELL_SIZE: 1,

  // --- Snap priorities (lower = preferred) ---

  PRIORITY_MARKUP_ENDPOINT: 0,
  PRIORITY_CONTENT_ENDPOINT: 1,
  PRIORITY_CONTENT_INTERSECTION: 2,
  PRIORITY_NEAREST_ON_EDGE: 3,
  PRIORITY_MIDPOINT: 4
} as const
