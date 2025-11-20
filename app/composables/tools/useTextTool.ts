import type { TextAnnotation } from '~/types/annotations'
import type { Point } from '~/types'
import { v4 as uuidv4 } from 'uuid'

export function useTextTool() {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()
  const settings = useSettingStore()

  const completed = computed(() =>
    annotationStore.getAnnotationsByType('text') as TextAnnotation[]
  )

  const editingId = ref<string | null>(null)

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
    }

    annotationStore.addAnnotation(text)
    editingId.value = text.id
  }

  function handleDoubleClick(id: string) {
    editingId.value = id
  }

  function updateText(id: string, content: string) {
    annotationStore.updateAnnotation(id, { content })
    editingId.value = null
  }

  function deleteText(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    completed,
    editingId,
    handleClick,
    handleDoubleClick,
    updateText,
    deleteText,
  }
}
