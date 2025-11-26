/**
 * Composable for calculating rotated PDF corner positions
 * Used by rotation handle components to position handles at actual PDF corners
 */
export function useRotatedPdfCorners() {
  const viewportStore = useViewportStore()

  const screenCorners = computed(() => {
    const width = viewportStore.getCanvasSize.width
    const height = viewportStore.getCanvasSize.height
    const rotation = viewportStore.rotation
    const scale = viewportStore.getScale
    // Add scroll position as dependency to force recomputation when dragging
    void viewportStore.canvasPos.scrollLeft
    void viewportStore.canvasPos.scrollTop

    if (!width || !height) return []

    // Get the canvas element's actual transformed position
    const canvas = document.querySelector('.pdf-canvas') as HTMLCanvasElement
    if (!canvas) return []

    const rect = canvas.getBoundingClientRect()

    // Center of the transformed canvas
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Half dimensions (scaled)
    const halfWidth = (width * scale) / 2
    const halfHeight = (height * scale) / 2

    const rotRad = degreesToRadians(rotation)

    // Calculate corners relative to center, accounting for rotation
    const corners = [
      { dx: -halfWidth, dy: -halfHeight },  // top-left
      { dx: halfWidth, dy: -halfHeight },   // top-right
      { dx: halfWidth, dy: halfHeight },    // bottom-right
      { dx: -halfWidth, dy: halfHeight },   // bottom-left
    ]

    return corners.map(({ dx, dy }) => {
      // Rotate the offset around center
      const rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad)
      const rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad)

      return {
        x: centerX + rotatedX,
        y: centerY + rotatedY
      }
    })
  })

  const center = computed(() => {
    // Add dependencies to force recomputation when needed
    void viewportStore.rotation
    void viewportStore.getScale
    void viewportStore.canvasPos.scrollLeft
    void viewportStore.canvasPos.scrollTop

    const canvas = document.querySelector('.pdf-canvas') as HTMLCanvasElement
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
  })

  return {
    screenCorners,
    center
  }
}
