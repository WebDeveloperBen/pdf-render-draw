import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { FILL_TOOL_DEFAULTS } from "~/components/Editor/Tools/Fill.vue"

const [useFillTool, useFillToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const historyStore = useHistoryStore()
  const viewportStore = useViewportStore()

  const completed = computed(
    () => base.annotationStore.getAnnotationsByTypeAndPage("fill", viewportStore.getCurrentPage) as Fill[]
  )

  const selected = computed(() => {
    if (!base.annotationStore.selectedAnnotation) return null
    if (base.annotationStore.selectedAnnotation.type !== "fill") return null
    return base.annotationStore.selectedAnnotation as Fill
  })

  // Drawing state
  const isDrawing = ref(false)
  const startPoint = ref<Point | null>(null)
  const currentRect = ref<{ x: number; y: number; width: number; height: number } | null>(null)

  function getSvgPoint(e: EditorInputEvent, svg: SVGSVGElement): Point {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function handleMouseDown(e: EditorInputEvent) {
    // Only start drawing if NOT clicking on an existing annotation
    const target = e.target as SVGElement
    const annotationId =
      target.dataset?.annotationId || target.closest("[data-annotation-id]")?.getAttribute("data-annotation-id")

    if (annotationId) {
      return // Don't start fill drawing on existing annotations
    }

    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    isDrawing.value = true
    startPoint.value = point
    currentRect.value = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0
    }
  }

  function handleMouseMove(e: EditorInputEvent) {
    if (!isDrawing.value || !startPoint.value) return

    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    const x = Math.min(startPoint.value.x, point.x)
    const y = Math.min(startPoint.value.y, point.y)
    const width = Math.abs(point.x - startPoint.value.x)
    const height = Math.abs(point.y - startPoint.value.y)

    currentRect.value = { x, y, width, height }
  }

  function handleMouseUp(_e: EditorInputEvent) {
    if (!isDrawing.value || !currentRect.value || currentRect.value.width === 0 || currentRect.value.height === 0) {
      // Cancel if no rectangle was drawn
      isDrawing.value = false
      startPoint.value = null
      currentRect.value = null
      return
    }

    const fill: Fill = {
      id: uuidv4(),
      type: "fill",
      pageNum: viewportStore.currentPage,
      x: currentRect.value.x,
      y: currentRect.value.y,
      width: currentRect.value.width,
      height: currentRect.value.height,
      color: FILL_TOOL_DEFAULTS.color,
      opacity: FILL_TOOL_DEFAULTS.opacity,
      rotation: 0
    }

    historyStore.addAnnotationWithHistory(fill)

    // Reset drawing state
    isDrawing.value = false
    startPoint.value = null
    currentRect.value = null
  }

  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    completed,
    selected,
    isDrawing,
    currentRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  }

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "fill",
    name: "Fill",
    icon: "lucide:paint-bucket",
    onMouseDown: tool.handleMouseDown,
    onMouseMove: tool.handleMouseMove,
    onMouseUp: tool.handleMouseUp
  })

  return tool
})

export { useFillTool, useFillToolState }
