/**
 * Snap system constants
 *
 * All tunable values for the snap engine in one place.
 */

export const SNAP = {
  /** Default snap distance threshold in PDF points */
  DISTANCE: 15,

  /** Spatial grid cell size for fast nearest-neighbor lookup (PDF points) */
  GRID_CELL_SIZE: 40,

  // --- PDF content extraction ---

  /** Minimum segment length to keep (filters font glyphs and noise) */
  MIN_SEGMENT_LENGTH: 3,

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

  // --- Snap priorities (lower = preferred) ---

  PRIORITY_MARKUP_ENDPOINT: 0,
  PRIORITY_CONTENT_ENDPOINT: 1,
  PRIORITY_CONTENT_INTERSECTION: 2,
  PRIORITY_MIDPOINT: 3,
  PRIORITY_NEAREST_ON_EDGE: 4
} as const
