/**
 * UI Constants
 * Centralized colors, sizes, and other UI constants used throughout the application
 */

export const COLORS = {
  // Selection colors
  SELECTION_BLUE: '#4299e1',
  SELECTION_BLUE_DARK: '#2b6cb0',
  SELECTION_BLUE_DARKER: '#2563eb',

  // Snap indicators
  SNAP_GREEN: '#10b981',

  // Preview colors
  PREVIEW_BLUE: 'blue',
} as const

export const TRANSFORM = {
  HANDLE_SIZE: 10,
  ROTATION_DISTANCE: 30,
  MIN_BOUNDS: 20,
} as const

export const SELECTION = {
  MARQUEE_FILL: 'rgba(66, 153, 225, 0.1)',
  MARQUEE_STROKE: '#4299e1',
  MARQUEE_STROKE_WIDTH: 2,
  MARQUEE_DASH_ARRAY: '4 4',
} as const

export const HIT_AREA = {
  THIN_LINE_WIDTH: 15, // Invisible hit area for thin lines
} as const
