/**
 * PDF rendering constants
 *
 * All timing, scaling, and rendering configuration values
 */

export const RENDERING = {
  /** Timeout before retrying a failed render (milliseconds) */
  RETRY_BASE_DELAY_MS: 500,

  /** Maximum number of retry attempts for failed renders */
  MAX_RETRIES: 3,

  /** Debounce delay for scale changes (milliseconds) */
  SCALE_DEBOUNCE_MS: 100,

  /** Maximum zoom scale factor (5x = 500%) */
  MAX_SCALE: 5,

  /** Minimum zoom scale factor (0.1x = 10%) */
  MIN_SCALE: 0.1,

  /** Zoom increment multiplier (1.25x = 125%) */
  ZOOM_FACTOR: 1.25,

  /** Standard PDF resolution in dots per inch */
  DEFAULT_DPI: 72,

  /** Device pixel ratio fallback if window.devicePixelRatio unavailable */
  DEFAULT_DEVICE_PIXEL_RATIO: 1,
} as const
