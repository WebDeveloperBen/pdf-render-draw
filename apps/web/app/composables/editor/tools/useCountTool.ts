import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { COUNT_TOOL_DEFAULTS } from "~/components/Editor/Tools/Count.vue"

const [useCountTool, useCountToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const historyStore = useHistoryStore()
  const viewportStore = useViewportStore()

  const completed = computed(
    () => base.annotationStore.getAnnotationsByTypeAndPage("count", viewportStore.getCurrentPage) as Count[]
  )

  const selected = computed(() => {
    if (!base.annotationStore.selectedAnnotation) return null
    if (base.annotationStore.selectedAnnotation.type !== "count") return null
    return base.annotationStore.selectedAnnotation as Count
  })

  // Track the next count number for this page
  const nextCountNumber = computed(() => {
    const existingCounts = completed.value
    if (existingCounts.length === 0) return 1

    // Find the highest number on this page
    const maxNumber = Math.max(...existingCounts.map((c) => c.number))
    return maxNumber + 1
  })

  // Track cursor position for preview
  const cursorPosition = computed(() => viewportStore.lastCursorPosition)

  function getSvgPoint(e: EditorInputEvent, svg: SVGSVGElement): Point {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function handleClick(e: EditorInputEvent) {
    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    // Use tool defaults for marker size (radius * 2), scaled by inverse viewport scale
    // so the bounding box matches the visual marker size at any zoom level
    const inv = viewportStore.getInverseScale
    const markerSize = COUNT_TOOL_DEFAULTS.marker.radius * 2 * inv
    const count: Count = {
      id: uuidv4(),
      type: "count",
      pageNum: viewportStore.currentPage,
      labelScale: inv,
      x: point.x - markerSize / 2, // x,y is top-left corner of bounding box
      y: point.y - markerSize / 2,
      width: markerSize,
      height: markerSize,
      number: nextCountNumber.value,
      rotation: degreesToRadians(-viewportStore.rotation) // Counter-rotate to appear upright at creation time
    }

    historyStore.addAnnotationWithHistory(count)
  }

  function deleteCount(id: string) {
    historyStore.deleteAnnotationWithHistory(id)
  }

  function updateCount(id: string, updates: Partial<Pick<Count, "number" | "label">>) {
    historyStore.updateAnnotationWithHistory(id, updates)
  }

  // Keyboard shortcut handler (optional)
  function handleKeyDown(_e: KeyboardEvent) {
    // Count tool can handle keyboard shortcuts here if needed
    // For now, it's a no-op
  }

  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    completed,
    selected,
    nextCountNumber,
    cursorPosition,
    handleClick,
    handleKeyDown,
    deleteCount,
    updateCount
  }

  // Register tool with event handlers
  registerTool({
    type: "count",
    name: "Count",
    icon: "lucide:hash",
    onClick: tool.handleClick,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { useCountTool, useCountToolState }
