import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { COUNT_TOOL_DEFAULTS } from "~/components/tools/Count.vue"

const [useCountTool, useCountToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const rendererStore = useRendererStore()

  const completed = computed(
    () => base.annotationStore.getAnnotationsByTypeAndPage("count", rendererStore.getCurrentPage) as Count[]
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
  const cursorPosition = computed(() => rendererStore.lastCursorPosition)

  function getSvgPoint(e: MouseEvent, svg: SVGSVGElement): Point {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function handleClick(e: MouseEvent) {
    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    // Use tool defaults for marker size (radius * 2)
    const markerSize = COUNT_TOOL_DEFAULTS.marker.radius * 2
    const count: Count = {
      id: uuidv4(),
      type: "count",
      pageNum: rendererStore.currentPage,
      x: point.x - markerSize / 2, // x,y is top-left corner of bounding box
      y: point.y - markerSize / 2,
      width: markerSize,
      height: markerSize,
      number: nextCountNumber.value,
      rotation: 0 // Counts don't rotate with page
    }

    base.annotationStore.addAnnotation(count)
  }

  function deleteCount(id: string) {
    base.annotationStore.deleteAnnotation(id)
  }

  function updateCount(id: string, updates: Partial<Pick<Count, "number" | "label">>) {
    base.annotationStore.updateAnnotation(id, updates)
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
    icon: "🔢",
    onClick: tool.handleClick,
    onKeyDown: tool.handleKeyDown
  })

  return tool
})

export { useCountTool, useCountToolState }
