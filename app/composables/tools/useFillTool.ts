import type { Fill } from "~/types/annotations"
import type { Point } from "~/types"
import { v4 as uuidv4 } from "uuid"
import { createInjectionState } from "@vueuse/core"
import { ref, computed } from "vue"
import { registerTool } from "~/composables/useToolRegistry"

// Register fill tool metadata immediately when module loads
registerTool({
  type: "fill",
  name: "Fill",
  icon: "🎨"
})

const [useFillTool, useFillToolState] = createInjectionState(() => {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()
  const settings = useSettingStore()

  // Get modifier keys for multi-select support (optional for tests)
  const modifierKeys = useModifierKeys()!

  const completed = computed(
    () => annotationStore.getAnnotationsByTypeAndPage("fill", rendererStore.getCurrentPage) as Fill[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotation) return null
    if (annotationStore.selectedAnnotation.type !== "fill") return null
    return annotationStore.selectedAnnotation as Fill
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
      color: settings.fillToolSettings.fillColor,
      opacity: settings.fillToolSettings.opacity,
      rotation: 0
    }

    annotationStore.addAnnotation(fill)

    // Reset drawing state
    isDrawing.value = false
    startPoint.value = null
    currentRect.value = null
  }

  function selectAnnotation(id: string) {
    // Support Shift+click for multi-select (fallback to false if not provided)
    annotationStore.selectAnnotation(id, { addToSelection: modifierKeys?.isShiftPressed.value ?? false })
  }

  function deleteFill(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    completed,
    selected,
    isDrawing,
    currentRect,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectAnnotation,
    deleteFill
  }
})

export { useFillTool, useFillToolState }
