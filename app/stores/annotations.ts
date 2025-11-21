import { defineStore } from 'pinia'
import type { Annotation } from '~/types/annotations'
import { validateAnnotation } from '~/types/annotations'

export const useAnnotationStore = defineStore('annotations', () => {
  // ============================================
  // State - DRASTICALLY SIMPLIFIED
  // ============================================

  const annotations = ref<Annotation[]>([])
  const activeTool = ref<Annotation['type'] | 'selection' | 'rotate' | ''>('')
  const selectedAnnotationId = ref<string | null>(null)
  const isDrawing = ref(false)

  // ============================================
  // Getters
  // ============================================

  function getAnnotationsByPage(pageNum: number) {
    return annotations.value.filter(a => a.pageNum === pageNum)
  }

  function getAnnotationsByType(type: Annotation['type']) {
    return annotations.value.filter(a => a.type === type)
  }

  function getAnnotationsByTypeAndPage(type: Annotation['type'], pageNum: number) {
    return annotations.value.filter(a => a.type === type && a.pageNum === pageNum)
  }

  function getAnnotationById(id: string) {
    return annotations.value.find(a => a.id === id)
  }

  const selectedAnnotation = computed(() => {
    if (!selectedAnnotationId.value) return null
    return getAnnotationById(selectedAnnotationId.value)
  })

  // ============================================
  // Actions
  // ============================================

  /**
   * Add a new annotation with validation
   * @throws {Error} If annotation is invalid
   */
  function addAnnotation(annotation: Annotation) {
    if (!validateAnnotation(annotation)) {
      console.error('Invalid annotation:', annotation)
      throw new Error(`Invalid annotation: missing or malformed data`)
    }
    annotations.value.push(annotation)
  }

  /**
   * Update an existing annotation with validation
   * @throws {Error} If updated annotation is invalid
   */
  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index === -1) {
      console.warn(`Annotation with id ${id} not found`)
      return
    }

    const updated = { ...annotations.value[index], ...updates }
    if (!validateAnnotation(updated)) {
      console.error('Invalid annotation update:', updated)
      throw new Error(`Invalid annotation update for id ${id}`)
    }

    annotations.value[index] = updated
  }

  function deleteAnnotation(id: string) {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index !== -1) {
      annotations.value.splice(index, 1)
    }
    if (selectedAnnotationId.value === id) {
      selectedAnnotationId.value = null
    }
  }

  function setActiveTool(tool: Annotation['type'] | 'selection' | '') {
    activeTool.value = tool
    selectedAnnotationId.value = null
    isDrawing.value = false
  }

  /**
   * Select an annotation
   * @param id - Annotation ID or null to deselect
   */
  function selectAnnotation(id: string | null) {
    if (id !== null && !annotations.value.some(a => a.id === id)) {
      console.warn(`Cannot select annotation ${id}: not found`)
      return
    }
    selectedAnnotationId.value = id
    if (id !== null) {
      activeTool.value = 'selection'
    }
  }

  function clearAnnotations() {
    annotations.value = []
    selectedAnnotationId.value = null
    isDrawing.value = false
  }

  /**
   * Set all annotations (replaces current set)
   * @throws {Error} If any annotation is invalid
   */
  function setAnnotations(newAnnotations: Annotation[]) {
    // Validate all annotations before setting
    const invalidAnnotations = newAnnotations.filter(ann => !validateAnnotation(ann))
    if (invalidAnnotations.length > 0) {
      console.error('Invalid annotations found:', invalidAnnotations)
      throw new Error(`Cannot set annotations: ${invalidAnnotations.length} invalid annotation(s)`)
    }
    annotations.value = newAnnotations
  }

  // ============================================
  // Persistence (replaces your complex save logic)
  // ============================================

  async function saveAnnotations(documentUrl: string, authorId: string) {
    const payload = annotations.value.map(ann => ({
      id: ann.id,
      document_url: documentUrl,
      author_id: authorId,
      page_num: ann.pageNum,
      type: ann.type,
      data: ann, // Entire annotation as JSON - NO NORMALIZATION!
    }))

    await $fetch('/api/annotations/upsert', {
      method: 'POST',
      body: payload,
    })
  }

  async function loadAnnotations(documentUrl: string) {
    const { data } = await $fetch<{ data: Array<{ data: Annotation }> }>('/api/annotations/fetch', {
      method: 'POST',
      body: { documentSlug: documentUrl },
    })

    // Data is already in the right format - NO DENORMALIZATION!
    annotations.value = data.map(item => item.data)
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
      const invalidAnnotations = imported.filter(ann => !validateAnnotation(ann))
      if (invalidAnnotations.length > 0) {
        console.error('Invalid annotations in import:', invalidAnnotations)
        throw new Error(`Import contains ${invalidAnnotations.length} invalid annotation(s)`)
      }

      annotations.value = imported
    } catch (error) {
      console.error('Failed to import annotations:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Invalid JSON format')
    }
  }

  function downloadJSON(filename: string = 'annotations.json') {
    const json = exportToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    // State
    annotations,
    activeTool,
    selectedAnnotationId,
    isDrawing,

    // Getters
    getAnnotationsByPage,
    getAnnotationsByType,
    getAnnotationsByTypeAndPage,
    getAnnotationById,
    selectedAnnotation,

    // Actions
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setActiveTool,
    selectAnnotation,
    clearAnnotations,
    setAnnotations,
    saveAnnotations,
    loadAnnotations,
    exportToJSON,
    importFromJSON,
    downloadJSON,
  }
})
