import type { Fill } from '~/types/annotations'
import type { Point } from '~/types'
import { v4 as uuidv4 } from 'uuid'
import { createInjectionState } from '@vueuse/core'

const [useProvideFillTool, useFillToolState] = createInjectionState(() => {
  const annotationStore = useAnnotationStore()
  const rendererStore = useRendererStore()
  const settings = useSettingStore()

  const completed = computed(() =>
    annotationStore.getAnnotationsByTypeAndPage('fill', rendererStore.getCurrentPage) as Fill[]
  )

  const selected = computed(() => {
    if (!annotationStore.selectedAnnotation) return null
    if (annotationStore.selectedAnnotation.type !== 'fill') return null
    return annotationStore.selectedAnnotation as Fill
  })

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

    const fill: Fill = {
      id: uuidv4(),
      type: 'fill',
      pageNum: rendererStore.currentPage,
      x: point.x,
      y: point.y,
      color: settings.fillToolSettings.fillColor,
      opacity: settings.fillToolSettings.opacity,
    }

    annotationStore.addAnnotation(fill)
  }

  function selectAnnotation(id: string) {
    annotationStore.selectAnnotation(id)
  }

  function deleteFill(id: string) {
    annotationStore.deleteAnnotation(id)
  }

  return {
    completed,
    selected,
    handleClick,
    selectAnnotation,
    deleteFill,
  }
})

export { useProvideFillTool, useFillToolState }

// Keep the original export name for provider for backwards compatibility
export const useFillTool = useProvideFillTool
