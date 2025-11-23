import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"
const [useFillTool, useFillToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const rendererStore = useRendererStore()

  const completed = computed(
    () => base.annotationStore.getAnnotationsByTypeAndPage("fill", rendererStore.getCurrentPage) as Fill[]
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

  function getSvgPoint(e: MouseEvent, svg: SVGSVGElement): Point {
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const transformed = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  function handleMouseDown(e: MouseEvent) {
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

  function handleMouseMove(e: MouseEvent) {
    if (!isDrawing.value || !startPoint.value) return

    const svg = e.currentTarget as SVGSVGElement
    const point = getSvgPoint(e, svg)

    const x = Math.min(startPoint.value.x, point.x)
    const y = Math.min(startPoint.value.y, point.y)
    const width = Math.abs(point.x - startPoint.value.x)
    const height = Math.abs(point.y - startPoint.value.y)

    currentRect.value = { x, y, width, height }
  }

  function handleMouseUp(_e: MouseEvent) {
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
      pageNum: rendererStore.currentPage,
      x: currentRect.value.x,
      y: currentRect.value.y,
      width: currentRect.value.width,
      height: currentRect.value.height,
      color: base.settings.fillToolSettings.fillColor,
      opacity: base.settings.fillToolSettings.opacity,
      rotation: 0
    }

    base.annotationStore.addAnnotation(fill)

    // Reset drawing state
    isDrawing.value = false
    startPoint.value = null
    currentRect.value = null
  }

  function deleteFill(id: string) {
    base.annotationStore.deleteAnnotation(id)
  }

  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    completed,
    selected,
    isDrawing,
    currentRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    deleteFill
  }

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "fill",
    name: "Fill",
    icon: "🎨",
    onMouseDown: tool.handleMouseDown,
    onMouseMove: tool.handleMouseMove,
    onMouseUp: tool.handleMouseUp,
    transform: {
      // Transform metadata
      structure: "positioned",
      groupRotation: "update-position-and-rotation",
      supportsGroupResize: true,
      supportsGroupMove: true,
      rotationCenter: "geometric-center",

      // Get rotation center - center of the rectangle
      getCenter: (annotation) => {
        const fill = annotation as Fill
        return {
          x: fill.x + fill.width / 2,
          y: fill.y + fill.height / 2
        }
      },

      // Apply rotation - just update rotation property
      applyRotation: (annotation, rotationDelta) => {
        const currentRotation = annotation.rotation || 0
        return { rotation: currentRotation + rotationDelta }
      },

      // Apply move - translate x,y
      applyMove: (annotation, deltaX, deltaY) => {
        const fill = annotation as Fill
        return {
          x: fill.x + deltaX,
          y: fill.y + deltaY
        }
      },

      // Apply resize - update bounds
      applyResize: (_annotation, newBounds, _originalBounds) => {
        return {
          x: newBounds.x,
          y: newBounds.y,
          width: newBounds.width,
          height: newBounds.height
        }
      }
    }
  })

  return tool
})

export { useFillTool, useFillToolState }
