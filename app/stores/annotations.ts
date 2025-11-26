import { defineStore } from "pinia"

export const useAnnotationStore = defineStore("annotations", () => {
  // ============================================
  // State - DRASTICALLY SIMPLIFIED
  // ============================================

  const annotations = ref<Annotation[]>([])
  const activeTool = ref<ToolType | "selection" | "rotate" | "">("measure")
  const selectedAnnotationIds = ref<string[]>([]) // Multi-select support
  const isDrawing = ref(false)

  // Temporary rotation delta during drag (added to stored rotation)
  const rotationDragDelta = ref(0)

  // ============================================
  // Getters
  // ============================================

  function getAnnotationsByPage(pageNum: number) {
    return annotations.value.filter((a) => a.pageNum === pageNum)
  }

  function getAnnotationsByType(type: ToolType) {
    return annotations.value.filter((a) => a.type === type)
  }

  function getAnnotationsByTypeAndPage(type: ToolType, pageNum: number) {
    const result = annotations.value.filter((a) => a.type === type && a.pageNum === pageNum)
    console.log(
      `[AnnotationStore] getAnnotationsByTypeAndPage(${type}, ${pageNum}):`,
      result.length,
      "of",
      annotations.value.length,
      "total"
    )
    return result
  }

  function getAnnotationById(id: string) {
    return annotations.value.find((a) => a.id === id)
  }

  // Backwards compatible: returns first selected annotation (or null)
  const selectedAnnotationId = computed(() => selectedAnnotationIds.value[0] || null)

  const selectedAnnotation = computed(() => {
    const id = selectedAnnotationId.value
    if (!id) return null
    return getAnnotationById(id)
  })

  // Multi-select: returns all selected annotations
  const selectedAnnotations = computed(() => {
    return selectedAnnotationIds.value
      .map((id) => getAnnotationById(id))
      .filter((ann): ann is Annotation => ann !== undefined)
  })

  // Check if an annotation is selected
  function isAnnotationSelected(id: string): boolean {
    return selectedAnnotationIds.value.includes(id)
  }

  /**
   * Get rotation transform string for an annotation
   * Automatically calculates center based on annotation type
   * Includes both stored rotation and temporary drag delta
   */
  function getRotationTransform(annotation: Annotation): string {
    const storedRotation = (annotation as { rotation?: number }).rotation || 0

    // For multi-select during rotation drag: apply drag delta as transform
    // This rotates fills around their own center to match the transform handles angle
    const isMultiSelected =
      selectedAnnotationIds.value.length > 1 && selectedAnnotationIds.value.includes(annotation.id)
    const isDragging = rotationDragDelta.value !== 0

    if (isMultiSelected && isDragging) {
      // Multi-select during drag:
      // - Positioned annotations (fill, text, count): rotate around the GROUP center (orbit + rotate)
      // - Point-based annotations (measure, area, etc.): no transform (points are updated directly)
      if (hasPositionedRect(annotation)) {
        // For positioned annotations: rotate around the GROUP center
        // This makes them orbit AND rotate visually during drag
        const rotation = rotationDragDelta.value
        if (rotation === 0) return ""

        // Use group center stored during drag
        const groupCenter =
          "_groupCenter" in annotation && annotation._groupCenter ? annotation._groupCenter : { x: 0, y: 0 } // Fallback

        const angleDeg = radiansToDegrees(rotation)
        const transform = `rotate(${angleDeg} ${groupCenter.x} ${groupCenter.y})`

        if (annotation.type === "count") {
          debugLog(`getRotationTransform - Count multi-select`, {
            annotationId: annotation.id.slice(0, 8),
            rotation: rotation,
            angleDeg,
            groupCenter,
            transform
          })
        }

        return transform
      }

      // For point-based tools: no transform (points are updated directly)
      return ""
    }

    // Single select OR multi-select when not dragging: apply rotation transform
    const isSingleSelected = selectedAnnotationId.value === annotation.id
    const rotation = isSingleSelected ? storedRotation + rotationDragDelta.value : storedRotation

    if (rotation === 0) return ""

    const center = getAnnotationCenter(annotation)
    const angleDeg = radiansToDegrees(rotation)
    const transform = `rotate(${angleDeg} ${center.x} ${center.y})`

    if (annotation.type === "count") {
      debugLog(`getRotationTransform - Count single-select`, {
        annotationId: annotation.id.slice(0, 8),
        storedRotation,
        rotationDragDelta: rotationDragDelta.value,
        totalRotation: rotation,
        angleDeg,
        center,
        transform
      })
    }

    return transform
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Recalculate derived values for annotations when points change
   * This ensures labels (midpoint, center) update when dragging/transforming
   * Note: calculateDistance/calculatePolygonArea read scale from settings store internally
   */
  function recalculateDerivedValues(annotation: Annotation): Record<string, unknown> {
    const derivedUpdates: Record<string, unknown> = {}

    if (isMeasurement(annotation)) {
      // Recalculate distance and midpoint
      const measurement = annotation as Measurement
      const [p1, p2] = measurement.points

      if (p1 && p2) {
        derivedUpdates.distance = calculateDistance(p1, p2)
        derivedUpdates.midpoint = calculateMidpoint(p1, p2)
      }
    } else if (isArea(annotation)) {
      // Recalculate area and center
      const area = annotation as Area
      if (area.points.length >= 3) {
        derivedUpdates.area = calculatePolygonArea(area.points)
        derivedUpdates.center = calculateCentroid(area.points)
      }
    } else if (isPerimeter(annotation)) {
      // Recalculate segments, totalLength, and center
      const perimeter = annotation as Perimeter
      if (perimeter.points.length >= 3) {
        const segments: PerimeterSegment[] = []
        let totalLength = 0

        for (let i = 0; i < perimeter.points.length; i++) {
          const start = perimeter.points[i]
          const end = perimeter.points[(i + 1) % perimeter.points.length]

          if (start && end) {
            const segmentLength = calculateDistance(start, end)
            totalLength += segmentLength

            segments.push({
              start,
              end,
              length: segmentLength,
              midpoint: calculateMidpoint(start, end)
            })
          }
        }

        derivedUpdates.segments = segments
        derivedUpdates.totalLength = totalLength
        derivedUpdates.center = calculateCentroid(perimeter.points)
      }
    }

    return derivedUpdates
  }

  /**
   * Add a new annotation with validation
   * @throws {Error} If annotation is invalid
   */
  function addAnnotation(annotation: Annotation) {
    if (!validateAnnotation(annotation)) {
      console.error("Invalid annotation:", annotation)
      throw new Error(`Invalid annotation: missing or malformed data`)
    }
    annotations.value.push(annotation)
  }

  /**
   * Update an existing annotation with validation
   * Automatically recalculates derived values (distance, area, center, etc.) when points change
   * @throws {Error} If updated annotation is invalid
   */
  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const index = annotations.value.findIndex((a) => a.id === id)
    if (index === -1) {
      console.warn(`Annotation with id ${id} not found`)
      return
    }

    const before = annotations.value[index]

    // Log rotation updates specifically
    if ("rotation" in updates) {
      console.log("[AnnotationStore] updateAnnotation - rotation update", {
        id,
        type: before,
        beforeRotation: (before as { rotation?: number }).rotation,
        beforeRotationDeg: ((before as { rotation?: number }).rotation || 0) * (180 / Math.PI),
        updateRotation: updates.rotation,
        updateRotationDeg: (updates.rotation as number) * (180 / Math.PI),
        allUpdates: Object.keys(updates)
      })
    }

    // Merge updates with existing annotation
    let updated = { ...annotations.value[index], ...updates }

    // If points were updated, recalculate derived values (distance, midpoint, area, center, etc.)
    if ("points" in updates && updates.points) {
      const derivedValues = recalculateDerivedValues(updated as Annotation)
      updated = { ...updated, ...derivedValues }
    }

    if (!validateAnnotation(updated)) {
      console.error("Invalid annotation update:", updated)
      throw new Error(`Invalid annotation update for id ${id}`)
    }

    annotations.value[index] = updated

    // Log what was actually saved for rotation updates
    if ("rotation" in updates) {
      console.log("[AnnotationStore] updateAnnotation - after save", {
        id,
        savedRotation: (annotations.value[index] as { rotation?: number }).rotation,
        savedRotationDeg: ((annotations.value[index] as { rotation?: number }).rotation || 0) * (180 / Math.PI)
      })
    }
  }

  function deleteAnnotation(id: string) {
    const index = annotations.value.findIndex((a) => a.id === id)
    if (index !== -1) {
      annotations.value.splice(index, 1)
    }
    // Remove from selection if selected
    const selIndex = selectedAnnotationIds.value.indexOf(id)
    if (selIndex !== -1) {
      selectedAnnotationIds.value.splice(selIndex, 1)
    }
  }

  function setActiveTool(tool: ToolType | "selection" | "rotate" | "") {
    activeTool.value = tool
    selectedAnnotationIds.value = []
    isDrawing.value = false
  }

  /**
   * Select annotation(s)
   * @param id - Annotation ID, array of IDs, or null to deselect all
   * @param options - Selection options
   */
  function selectAnnotation(
    id: string | string[] | null,
    options: { addToSelection?: boolean; toggle?: boolean } = {}
  ) {
    // Deselect all
    if (id === null) {
      selectedAnnotationIds.value = []
      rotationDragDelta.value = 0
      return
    }

    // Convert single ID to array for uniform handling
    const ids = Array.isArray(id) ? id : [id]

    // Validate all IDs exist
    const invalidIds = ids.filter((id) => !annotations.value.some((a) => a.id === id))
    if (invalidIds.length > 0) {
      console.warn(`Cannot select annotations: not found:`, invalidIds)
      return
    }

    // Handle multi-select modes
    if (options.addToSelection) {
      // Add to selection (Shift+Click)
      ids.forEach((id) => {
        if (!selectedAnnotationIds.value.includes(id)) {
          selectedAnnotationIds.value.push(id)
        }
      })
    } else if (options.toggle) {
      // Toggle selection (Cmd/Ctrl+Click)
      ids.forEach((id) => {
        const index = selectedAnnotationIds.value.indexOf(id)
        if (index !== -1) {
          selectedAnnotationIds.value.splice(index, 1)
        } else {
          selectedAnnotationIds.value.push(id)
        }
      })
    } else {
      // Replace selection (default behavior)
      selectedAnnotationIds.value = [...ids]
    }

    // Switch to selection tool if anything is selected
    if (selectedAnnotationIds.value.length > 0) {
      activeTool.value = "selection"
    } else {
      rotationDragDelta.value = 0
    }
  }

  /**
   * Select multiple annotations by IDs
   */
  function selectAnnotations(ids: string[]) {
    selectAnnotation(ids)
  }

  /**
   * Deselect all annotations
   */
  function deselectAll() {
    selectAnnotation(null)
  }

  function clearAnnotations() {
    annotations.value = []
    selectedAnnotationIds.value = []
    isDrawing.value = false
  }

  /**
   * Set all annotations (replaces current set)
   * @throws {Error} If any annotation is invalid
   */
  function setAnnotations(newAnnotations: Annotation[]) {
    // Validate all annotations before setting
    const invalidAnnotations = newAnnotations.filter((ann) => !validateAnnotation(ann))
    if (invalidAnnotations.length > 0) {
      console.error("Invalid annotations found:", invalidAnnotations)
      throw new Error(`Cannot set annotations: ${invalidAnnotations.length} invalid annotation(s)`)
    }
    annotations.value = newAnnotations
  }

  // ============================================
  // Persistence (replaces your complex save logic)
  // ============================================

  async function saveAnnotations(documentUrl: string, authorId: string) {
    const payload = annotations.value.map((ann) => ({
      id: ann.id,
      document_url: documentUrl,
      author_id: authorId,
      page_num: ann.pageNum,
      type: ann.type,
      data: ann // Entire annotation as JSON - NO NORMALIZATION!
    }))

    await $fetch("/api/annotations/upsert", {
      method: "POST",
      body: payload
    })
  }

  async function loadAnnotations(documentUrl: string) {
    const { data } = await $fetch<{ data: Array<{ data: Annotation }> }>("/api/annotations/fetch", {
      method: "POST",
      body: { documentSlug: documentUrl }
    })

    // Data is already in the right format - NO DENORMALIZATION!
    annotations.value = data.map((item) => item.data)
  }

  // ============================================
  // JSON Export/Import (for local backup/restore)
  // ============================================

  function exportToJSON(): string {
    return JSON.stringify(annotations.value, null, 2)
  }

  /**
   * Import annotations from JSON with validation
   * @throws {Error} If JSON is invalid or contains invalid annotations
   */
  function importFromJSON(jsonString: string) {
    try {
      const imported = JSON.parse(jsonString) as Annotation[]

      // Validate all imported annotations
      const invalidAnnotations = imported.filter((ann) => !validateAnnotation(ann))
      if (invalidAnnotations.length > 0) {
        console.error("Invalid annotations in import:", invalidAnnotations)
        throw new Error(`Import contains ${invalidAnnotations.length} invalid annotation(s)`)
      }

      annotations.value = imported
    } catch (error) {
      console.error("Failed to import annotations:", error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Invalid JSON format")
    }
  }

  function downloadJSON(filename: string = "annotations.json") {
    const json = exportToJSON()
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    // State
    annotations,
    activeTool,
    selectedAnnotationIds, // Multi-select array
    selectedAnnotationId, // Backwards compat: first selected or null
    isDrawing,
    rotationDragDelta,

    // Getters
    getAnnotationsByPage,
    getAnnotationsByType,
    getAnnotationsByTypeAndPage,
    getAnnotationById,
    selectedAnnotation, // First selected annotation
    selectedAnnotations, // All selected annotations
    isAnnotationSelected, // Check if ID is selected
    getRotationTransform,

    // Debug: watch annotations for changes
    ...(import.meta.client
      ? {
          _debug: watch(
            annotations,
            (newVal) => {
              console.log(
                "[AnnotationStore] Annotations changed! Count:",
                newVal.length,
                newVal.map((a) => a.type)
              )
            },
            { deep: true }
          )
        }
      : {}),

    // Actions
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setActiveTool,
    selectAnnotation, // Supports single, multi, and options
    selectAnnotations, // Convenience for multi-select
    deselectAll, // Clear selection
    clearAnnotations,
    setAnnotations,
    saveAnnotations,
    loadAnnotations,
    exportToJSON,
    importFromJSON,
    downloadJSON
  }
})
