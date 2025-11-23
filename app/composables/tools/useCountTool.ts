import { v4 as uuidv4 } from "uuid"
import { createInjectionState } from "@vueuse/core"
import { registerTool } from "~/composables/useToolRegistry"
import type { Count } from "~/types/annotations"

// Register count tool metadata immediately when module loads
registerTool({
  type: "count",
  name: "Count",
  icon: "🔢"
})

const [useCountTool, useCountToolState] = createInjectionState(() => {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()

  // Get modifier keys for multi-select support (optional for tests)
  const modifierKeys = useModifierKeys()!

  const completed = computed(
    () => annotationStore.getAnnotationsByTypeAndPage("count", rendererStore.getCurrentPage) as Count[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotation) return null
    if (annotationStore.selectedAnnotation.type !== "count") return null
    return annotationStore.selectedAnnotation as Count
  })

  // Track the next count number for this page
  const nextCountNumber = computed(() => {
    const existingCounts = completed.value
    if (existingCounts.length === 0) return 1

    // Find the highest number on this page
    const maxNumber = Math.max(...existingCounts.map(c => c.number))
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

    const count: Count = {
      id: uuidv4(),
      type: "count",
      pageNum: rendererStore.currentPage,
      x: point.x,
      y: point.y,
      number: nextCountNumber.value,
      rotation: 0 // Counts don't rotate with page
    }

    annotationStore.addAnnotation(count)
  }

  function selectAnnotation(id: string) {
    // Support Shift+click for multi-select (fallback to false if not provided)
    annotationStore.selectAnnotation(id, { addToSelection: modifierKeys?.isShiftPressed.value ?? false })
  }

  function deleteCount(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  function updateCount(id: string, updates: Partial<Pick<Count, 'number' | 'label'>>) {
    annotationStore.updateAnnotation(id, updates)
  }

  return {
    completed,
    selected,
    nextCountNumber,
    cursorPosition,
    handleClick,
    selectAnnotation,
    deleteCount,
    updateCount
  }
})

export { useCountTool, useCountToolState }