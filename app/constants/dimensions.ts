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

  // Control Panel Positioning (pixels)
  /** Distance from bottom of viewport for fixed controls */
  CONTROL_BOTTOM_OFFSET: 20,

  /** Distance from right of viewport for rightmost controls */
  CONTROL_RIGHT_OFFSET: 20,

  /** Distance from left of viewport for leftmost controls */
  CONTROL_LEFT_OFFSET: 20,

  /** Horizontal offset for rotation controls from right edge */
  ROTATION_CONTROL_OFFSET_X: 220,

  /** Horizontal offset for scale controls from right edge */
  SCALE_CONTROL_OFFSET_X: 450,

  // UI Spacing (pixels)
  /** Standard gap between toolbar items */
  TOOLBAR_GAP: 8,

  /** Gap between header elements */
  HEADER_GAP: 16,

  /** Standard button padding */
  BUTTON_PADDING: 8,
  BUTTON_PADDING_INLINE: 12,

  // Interaction Thresholds
  /** Minimum pixel movement to consider as "moved" (not a click) */
  MOVEMENT_THRESHOLD: 1,

  /** Snap angle increment in degrees for Shift+drag */
  ANGLE_SNAP_DEGREES: 45
} as const
