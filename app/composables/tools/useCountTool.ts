import { v4 as uuidv4 } from "uuid"
import { useCreateBaseTool } from "./useCreateBaseTool"

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

    const count: Count = {
      id: uuidv4(),
      type: "count",
      pageNum: rendererStore.currentPage,
      x: point.x,
      y: point.y,
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

  // Register tool with full metadata, event handlers, and transformation logic
  registerTool({
    type: "count",
    name: "Count",
    icon: "🔢",
    onClick: tool.handleClick,
    onKeyDown: tool.handleKeyDown,
    transform: {
      // Transform metadata
      structure: "positioned",
      groupRotation: "none", // Count markers don't rotate
      supportsGroupResize: false,
      supportsGroupMove: true,
      rotationCenter: "geometric-center",

      // Get rotation center - x,y is already the center point of the count marker
      getCenter: (annotation) => {
        const count = annotation as Count
        return { x: count.x, y: count.y }
      },

      // Apply rotation - just update rotation property
      applyRotation: (annotation, rotationDelta) => {
        const currentRotation = annotation.rotation || 0
        return { rotation: currentRotation + rotationDelta }
      },

      // Apply move - translate x,y
      applyMove: (annotation, deltaX, deltaY) => {
        const count = annotation as Count
        return {
          x: count.x + deltaX,
          y: count.y + deltaY
        }
      },

      // Apply resize - count markers don't resize, just move the center
      applyResize: (annotation, newBounds, originalBounds) => {
        const count = annotation as Count
        // Calculate the center offset from original bounds and apply to new bounds
        const offsetX = count.x - (originalBounds.x + originalBounds.width / 2)
        const offsetY = count.y - (originalBounds.y + originalBounds.height / 2)

        return {
          x: newBounds.x + newBounds.width / 2 + offsetX,
          y: newBounds.y + newBounds.height / 2 + offsetY
        }
      }
    }
  })

  return tool
})

export { useCountTool, useCountToolState }
