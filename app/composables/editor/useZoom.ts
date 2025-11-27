/**
 * Zoom Handling Composable
 *
 * Handles wheel/trackpad zoom events with device detection and normalization.
 * Provides cursor-aware zooming for better UX.
 */

import { RENDERING } from "@/constants/rendering"

export function useZoom() {
  const viewportStore = useViewportStore()

  /**
   * Handle wheel zoom event with trackpad/mouse normalization
   *
   * @param e - WheelEvent from scroll/wheel
   * @param containerElement - The container element to calculate mouse position relative to
   */
  function handleWheelZoom(e: WheelEvent, containerElement: HTMLElement) {
    // Prevent default zoom behavior
    e.preventDefault()

    // Get mouse position relative to container for cursor-aware zoom
    const rect = containerElement.getBoundingClientRect()
    const mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    // Detect device type based on deltaY magnitude
    // Trackpad: small continuous values (typically 1-50)
    // Mouse wheel: large discrete values (typically 100+)
    const isTrackpad = Math.abs(e.deltaY) < 50

    let newScale: number

    if (isTrackpad) {
      // Trackpad: smooth, granular zoom
      // Use a percentage of deltaY for fine control
      const sensitivity = 0.003 // Increased from 0.001 for faster zoom (0.003 = 0.3% per deltaY unit)
      const zoomFactor = 1 - e.deltaY * sensitivity
      newScale = viewportStore.getScale * zoomFactor
    } else {
      // Mouse wheel: discrete zoom steps
      // Use standard zoom factor for predictable jumps (1.1x per step)
      const zoomFactor = e.deltaY < 0 ? RENDERING.ZOOM_FACTOR : 1 / RENDERING.ZOOM_FACTOR
      newScale = viewportStore.getScale * zoomFactor
    }

    // Apply zoom with cursor-aware positioning
    viewportStore.zoomToScale(newScale, mousePos)
  }

  /**
   * Handle wheel scroll (non-zoom panning)
   *
   * @param e - WheelEvent from scroll/wheel
   */
  function handleWheelScroll(e: WheelEvent) {
    viewportStore.setCanvasPos({
      scrollTop: viewportStore.getCanvasPos.scrollTop - e.deltaY,
      scrollLeft: viewportStore.getCanvasPos.scrollLeft - e.deltaX
    })
  }

  /**
   * Main wheel event handler - routes to zoom or scroll based on modifiers
   *
   * @param e - WheelEvent
   * @param containerElement - Container element for cursor position calculation
   */
  function handleWheel(e: WheelEvent, containerElement: HTMLElement) {
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl/Cmd + wheel
      handleWheelZoom(e, containerElement)
    } else {
      // Pan/scroll normally
      handleWheelScroll(e)
    }
  }

  return {
    handleWheel,
    handleWheelZoom,
    handleWheelScroll
  }
}
