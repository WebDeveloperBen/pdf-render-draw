import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"
import { TEXT_TOOL_DEFAULTS } from "~/components/Editor/Tools/Text.vue"

const [useTextTool, useTextToolState] = createInjectionState(() => {
  // Inherit base functionality
  const base = useCreateBaseTool()
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

    // Initial dimensions: fixed width, height fits single line
    const width = defaultWidth
    const height = Math.max(Math.ceil(fontSize * lineHeight), minHeight)

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
      fontSize,
      color,
      rotation: degreesToRadians(-viewportStore.rotation) // Counter-rotate to appear upright in viewport
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

  function finishEditing(dimensions?: { width?: number; height?: number }) {
    textEditing.finishEditing(dimensions)
  }

  function deleteText(id: string) {
    base.annotationStore.deleteAnnotation(id)
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

    // Measure text width using a hidden element
    const div = document.createElement("div")
    div.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      font-size: ${fontSize}px;
      font-family: ${fontFamily};
      line-height: ${lineHeight};
    `

    // Measure each line and find the widest
    const lines = content.split("\n")
    let maxLineWidth = 0

    for (const line of lines) {
      div.textContent = line || " "
      document.body.appendChild(div)
      maxLineWidth = Math.max(maxLineWidth, div.offsetWidth)
      document.body.removeChild(div)
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
    icon: "T",
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
