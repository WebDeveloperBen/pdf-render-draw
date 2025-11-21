/**
 * UI dimensions and measurements
 *
 * All size, spacing, and distance values in pixels or PDF points
 */

export const DIMENSIONS = {
  /** Width of sidebar panel in pixels */
  SIDEBAR_WIDTH: 280,

  /** Width of thumbnail images in sidebar (pixels) */
  THUMBNAIL_WIDTH: 140,

  /** Estimated height per thumbnail item for virtual scrolling (pixels) */
  THUMBNAIL_ITEM_HEIGHT: 180,

  /** Number of items to render outside viewport (virtual scrolling buffer) */
  THUMBNAIL_BUFFER_SIZE: 3,

  /** Maximum number of cached thumbnails (LRU eviction) */
  MAX_CACHED_THUMBNAILS: 30,

  /** Distance for snap-to-close when drawing polygons (PDF points) */
  SNAP_DISTANCE_PDF_POINTS: 25,

  /** Hit area width for selecting/clicking annotations (PDF points) */
  HIT_AREA_WIDTH: 15,

  /** Time threshold for double-click detection (milliseconds) */
  CLICK_CLOSE_THRESHOLD_MS: 250,
} as const
