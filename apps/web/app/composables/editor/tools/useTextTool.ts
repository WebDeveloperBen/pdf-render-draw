import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { TEXT_TOOL_DEFAULTS } from "~/components/Editor/Tools/Text.vue"

const [useTextTool, useTextToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
  const historyStore = useHistoryStore()
  const viewportStore = useViewportStore()

  // Use global text editing state (singleton composable)
  const textEditing = useTextEditingState()

  const completed = computed(
    () => base.annotationStore.getAnnotationsByTypeAndPage("text", viewportStore.getCurrentPage) as TextAnnotation[]
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

    // Use tool defaults from constants (will be user-configurable in the future)
    const { defaultWidth, minHeight, fontSize, lineHeight, color, placeholder } = TEXT_TOOL_DEFAULTS

    // Scale dimensions by inverse viewport scale so the text box appears
    // the same screen size regardless of zoom level
    const inv = viewportStore.getInverseScale

    // Initial dimensions: fixed width, height fits single line
    const width = defaultWidth * inv
    const scaledFontSize = fontSize * inv
    const height = Math.max(Math.ceil(scaledFontSize * lineHeight), minHeight * inv)

    // Store x, y as TOP-LEFT corner (consistent with Fill, Count, and other positioned annotations)
    // This ensures bounds calculation works correctly for selection and transforms
    const text: TextAnnotation = {
      id: uuidv4(),
      type: "text",
      pageNum: viewportStore.currentPage,
      x: point.x - width / 2,
      y: point.y - height / 2,
      width,
      height,
      content: placeholder,
      fontSize: scaledFontSize,
      color,
      rotation: degreesToRadians(-viewportStore.rotation) // Counter-rotate to appear upright in viewport
    }

    historyStore.addAnnotationWithHistory(text)
    textEditing.startEditing(text.id)
  }

  function handleDoubleClick(id: string) {
    textEditing.startEditing(id)
  }

  function updateText(id: string, content: string) {
    historyStore.updateAnnotationWithHistory(id, { content })
    textEditing.cancelEditing()
  }

  function finishEditing(dimensions?: { width?: number; height?: number }) {
    textEditing.finishEditing(dimensions)
  }

  function deleteText(id: string) {
    historyStore.deleteAnnotationWithHistory(id)
  }

  /**
   * Get minimum dimensions for a text annotation based on content
   * Used by scaling to prevent shrinking smaller than text content
   */
  function getMinDimensions(annotation: Annotation): { width: number; height: number } {
    if (annotation.type !== "text" || !("content" in annotation) || !("fontSize" in annotation)) {
      return { width: 10, height: 10 }
    }

    const textAnnotation = annotation as TextAnnotation
    const { fontSize, content } = textAnnotation
    const { lineHeight, fontFamily, editor, minHeight: configMinHeight } = TEXT_TOOL_DEFAULTS

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) {
      return { width: 10, height: 10 }
    }

    context.font = `${fontSize}px ${fontFamily}`

    const lines = content.split("\n")
    let maxLineWidth = 0

    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, context.measureText(line || " ").width)
    }

    // Add buffer for sub-pixel rendering + editor border/padding
    const offset = editor.borderWidth + editor.padding
    const totalOffset = offset * 2
    const minWidth = Math.ceil(maxLineWidth) + 4 + totalOffset

    // Minimum height is single line height + border/padding
    const minHeight = Math.max(Math.ceil(fontSize * lineHeight), configMinHeight) + totalOffset

    return { width: minWidth, height: minHeight }
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

  // Register tool with metadata and event handlers
  // Transformation logic is handled generically by useTransformBase based on data structure
  registerTool({
    type: "text",
    name: "Text",
    icon: "lucide:type",
    onClick: tool.handleClick,
    onDoubleClick: (id: string) => {
      // Use global text editing state (singleton composable, no injection needed)
      const textEditing = useTextEditingState()
      textEditing.startEditing(id)
    },
    getMinDimensions
  })

  return tool
})

export { useTextTool, useTextToolState }
