import type { TextAnnotation } from '~/types/annotations'
import type { Point } from '~/types'
import { v4 as uuidv4 } from 'uuid'
import { createInjectionState } from '@vueuse/core'

const [useProvideTextTool, useTextToolState] = createInjectionState(() => {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()

  const completed = computed(() =>
    annotationStore.getAnnotationsByTypeAndPage('text', rendererStore.getCurrentPage) as TextAnnotation[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotation) return null
    if (annotationStore.selectedAnnotation.type !== 'text') return null
    return annotationStore.selectedAnnotation as TextAnnotation
  })

  const editingId = ref<string | null>(null)
  const editingContent = ref<string>('')

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

    const text: TextAnnotation = {
      id: uuidv4(),
      type: 'text',
      pageNum: rendererStore.currentPage,
      x: point.x,
      y: point.y,
      width: 200,
      height: 50,
      content: 'Double-click to edit',
      fontSize: 16,
      color: '#000000',
      rotation: -rendererStore.rotation, // Counter-rotate to appear upright, then "stamp" it
    }

    annotationStore.addAnnotation(text)
    editingId.value = text.id
    editingContent.value = text.content
  }

  function handleDoubleClick(id: string) {
    const annotation = annotationStore.getAnnotationById(id) as TextAnnotation | undefined
    if (annotation) {
      editingId.value = id
      editingContent.value = annotation.content
    }
  }

  function selectAnnotation(id: string) {
    annotationStore.selectAnnotation(id)
  }

  function updateText(id: string, content: string) {
    annotationStore.updateAnnotation(id, { content })
    editingId.value = null
    editingContent.value = ''
  }

  function finishEditing() {
    if (editingId.value && editingContent.value !== undefined) {
      annotationStore.updateAnnotation(editingId.value, { content: editingContent.value })
    }
    editingId.value = null
    editingContent.value = ''
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
    deleteText,
  }
})

export { useProvideTextTool, useTextToolState }

// Keep the original export name for provider for backwards compatibility
export const useTextTool = useProvideTextTool
