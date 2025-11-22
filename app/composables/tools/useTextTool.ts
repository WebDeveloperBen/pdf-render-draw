import { v4 as uuidv4 } from "uuid"
import { createInjectionState } from "@vueuse/core"

const [useTextTool, useTextToolState] = createInjectionState(() => {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()

  // Get modifier keys for multi-select support (optional for tests)
  const modifierKeys = useModifierKeys()!

  // Use global text editing state (singleton composable)
  const textEditing = useTextEditingState()

  const completed = computed(
    () => annotationStore.getAnnotationsByTypeAndPage("text", rendererStore.getCurrentPage) as TextAnnotation[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotation) return null
    if (annotationStore.selectedAnnotation.type !== "text") return null
    return annotationStore.selectedAnnotation as TextAnnotation
  })

  const editingId = textEditing.editingId
  const editingContent = textEditing.editingContent

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

    // Text dimensions
    const width = 200
    const height = 50
    const fontSize = 16

    // Center text on cursor position
    // Visual bounds: (x - 5, y - fontSize - 2, width + 10, height + 4)
    // Visual center: (x + width/2, y - fontSize - 2 + height/2)
    // To center on cursor: x + width/2 = point.x → x = point.x - width/2
    //                      y - fontSize - 2 + height/2 = point.y → y = point.y + fontSize + 2 - height/2
    const text: TextAnnotation = {
      id: uuidv4(),
      type: "text",
      pageNum: rendererStore.currentPage,
      x: point.x - width / 2,
      y: point.y + fontSize + 2 - height / 2,
      width,
      height,
      content: "Double-click to edit",
      fontSize,
      color: "#000000",
      rotation: degreesToRadians(-rendererStore.rotation) // Counter-rotate to appear upright in viewport
    }

    annotationStore.addAnnotation(text)
    textEditing.startEditing(text.id)
  }

  function handleDoubleClick(id: string) {
    textEditing.startEditing(id)
  }

  function selectAnnotation(id: string) {
    // Support Shift+click for multi-select (fallback to false if not provided)
    annotationStore.selectAnnotation(id, { addToSelection: modifierKeys?.isShiftPressed.value ?? false })
  }

  function updateText(id: string, content: string) {
    annotationStore.updateAnnotation(id, { content })
    textEditing.cancelEditing()
  }

  function finishEditing() {
    textEditing.finishEditing()
  }

  function deleteText(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    completed,
    selected,
    editingId,
    editingContent,
    handleClick,
    handleDoubleClick,
    selectAnnotation,
    updateText,
    finishEditing,
    deleteText
  }
})

export { useTextTool, useTextToolState }

// Register text tool in the plugin system
registerTool({
  type: "text",
  component: defineAsyncComponent(() => import("~/components/tools/Text.vue")),
  onDoubleClick: (id: string) => {
    // Use global text editing state (singleton composable, no injection needed)
    const textEditing = useTextEditingState()
    textEditing.startEditing(id)
  }
})
