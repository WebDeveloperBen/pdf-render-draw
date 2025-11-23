import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"

const [useTextTool, useTextToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const rendererStore = useRendererStore()

  // Use global text editing state (singleton composable)
  const textEditing = useTextEditingState()

  const completed = computed(
    () => base.annotationStore.getAnnotationsByTypeAndPage("text", rendererStore.getCurrentPage) as TextAnnotation[]
  )

  const selected = computed(() => {
    if (!base.annotationStore.selectedAnnotation) return null
    if (base.annotationStore.selectedAnnotation.type !== "text") return null
    return base.annotationStore.selectedAnnotation as TextAnnotation
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

    base.annotationStore.addAnnotation(text)
    textEditing.startEditing(text.id)
  }

  function handleDoubleClick(id: string) {
    textEditing.startEditing(id)
  }

  function updateText(id: string, content: string) {
    base.annotationStore.updateAnnotation(id, { content })
    textEditing.cancelEditing()
  }

  function finishEditing() {
    textEditing.finishEditing()
  }

  function deleteText(id: string) {
    base.annotationStore.deleteAnnotation(id)
  }

  const tool = {
    ...base, // Inherit: stores, getRotationTransform, selectAnnotation
    completed,
    selected,
    editingId,
    editingContent,
    handleClick,
    handleDoubleClick,
    updateText,
    finishEditing,
    deleteText
  }

  // Register tool with full metadata and event handlers
  registerTool({
    type: "text",
    name: "Text",
    icon: "T",
    onClick: tool.handleClick,
    onDoubleClick: (id: string) => {
      // Use global text editing state (singleton composable, no injection needed)
      const textEditing = useTextEditingState()
      textEditing.startEditing(id)
    }
  })

  return tool
})

export { useTextTool, useTextToolState }
