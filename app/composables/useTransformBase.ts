/**
 * Base Transform Composable
 *
 * Provides shared state and utilities for both single and group transformations.
 * Extracted from Transform.vue to reduce duplication.
 */

import { useSvgCoordinates } from "@/composables/useSvgCoordinates"
import { debugLog } from "~/utils/debug"
import type { Point } from "~/types"

export interface TransformHandlers {
  onResize: (deltaX: number, deltaY: number) => void
  onRotate: (svgX: number, svgY: number) => void
  onMove: (deltaX: number, deltaY: number) => void
  onEndDrag: (mode: "resize" | "rotate" | "move" | null, hasMoved: boolean) => void
}

export function useTransformBase() {
  const { getSvgPoint: getSvgPointUtil } = useSvgCoordinates()

  // Shared state
  const isDragging = ref(false)
  const activeHandle = ref<string | null>(null)
  const dragMode = ref<"resize" | "rotate" | "move" | null>(null)
  const dragStart = ref<Point | null>(null)
  const originalBounds = ref<Bounds | null>(null)
  const startRotationAngle = ref(0)
  const currentRotationDelta = ref(0)
  const isShiftPressed = ref(false)
  const hasMoved = ref(false)

  const svgRef = ref<SVGGElement | null>(null)

  // Convert screen coordinates to SVG coordinates
  function getSvgPoint(e: MouseEvent): Point | null {
    const svg = svgRef.value?.ownerSVGElement
    if (!svg) return null
    return getSvgPointUtil(e, svg)
  }

  // Generic drag handler that routes to specific handlers
  function createDragHandler(handlers: TransformHandlers) {
    return (e: MouseEvent) => {
      if (!isDragging.value || !dragStart.value || !originalBounds.value) return

      const svgPoint = getSvgPoint(e)
      if (!svgPoint) return

      const deltaX = svgPoint.x - dragStart.value.x
      const deltaY = svgPoint.y - dragStart.value.y

      // Track if mouse actually moved (to distinguish click from drag)
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        hasMoved.value = true
      }

      if (dragMode.value === "resize") {
        handlers.onResize(deltaX, deltaY)
      } else if (dragMode.value === "rotate") {
        handlers.onRotate(svgPoint.x, svgPoint.y)
      } else if (dragMode.value === "move") {
        handlers.onMove(deltaX, deltaY)
      }
    }
  }

  // Generic end drag handler
  function createEndDragHandler(handlers: TransformHandlers) {
    return () => {
      const annotationStore = useAnnotationStore()

      // Clear drag delta IMMEDIATELY
      annotationStore.rotationDragDelta = 0

      const wasDragging = isDragging.value
      const mode = dragMode.value
      const moved = hasMoved.value

      // Stop dragging IMMEDIATELY
      isDragging.value = false

      if (!wasDragging) {
        cleanupState()
        return
      }

      // Call the specific end drag handler
      handlers.onEndDrag(mode, moved)

      // Clean up state
      cleanupState()
    }
  }

  function cleanupState() {
    activeHandle.value = null
    dragMode.value = null
    dragStart.value = null
    originalBounds.value = null
    startRotationAngle.value = 0
    currentRotationDelta.value = 0
    hasMoved.value = false
  }

  // Set up event listeners
  function setupEventListeners(handlers: TransformHandlers) {
    const handleDrag = createDragHandler(handlers)
    const handleEndDrag = createEndDragHandler(handlers)

    useEventListener(window, "mousemove", handleDrag, { passive: false })
    useEventListener(window, "mouseup", handleEndDrag)
    useEventListener(window, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Shift") isShiftPressed.value = true
    })
    useEventListener(window, "keyup", (e: KeyboardEvent) => {
      if (e.key === "Shift") isShiftPressed.value = false
    })
  }

  // Generic start drag
  function startDrag(
    e: MouseEvent,
    handle: string,
    mode: "resize" | "rotate" | "move",
    bounds: Bounds,
    onStart?: (svgPoint: Point) => void
  ) {
    const svgPoint = getSvgPoint(e)
    if (!svgPoint) return

    debugLog("TransformBase", `Starting drag - Handle: ${handle}, Mode: ${mode}`)

    isDragging.value = true
    activeHandle.value = handle
    dragMode.value = mode
    dragStart.value = svgPoint
    originalBounds.value = { ...bounds }
    hasMoved.value = false

    // Allow component-specific initialization
    if (onStart) {
      onStart(svgPoint)
    }

    e.preventDefault()
    e.stopPropagation()
  }

  return {
    // State
    isDragging,
    activeHandle,
    dragMode,
    dragStart,
    originalBounds,
    startRotationAngle,
    currentRotationDelta,
    isShiftPressed,
    hasMoved,
    svgRef,

    // Functions
    getSvgPoint,
    startDrag,
    setupEventListeners,
    cleanupState,
  }
}
