import { defineStore } from 'pinia'
import type { Annotation } from '~/types/annotations'

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

  const getAnnotationsByPage = computed(() => (pageNum: number) => {
    return annotations.value.filter(a => a.pageNum === pageNum)
  })

  const getAnnotationsByType = computed(() => (type: Annotation['type']) => {
    return annotations.value.filter(a => a.type === type)
  })

  const getAnnotationById = computed(() => (id: string) => {
    return annotations.value.find(a => a.id === id)
  })

  const selectedAnnotation = computed(() => {
    if (!selectedAnnotationId.value) return null
    return getAnnotationById.value(selectedAnnotationId.value)
  })

  // ============================================
  // Actions
  // ============================================

  function addAnnotation(annotation: Annotation) {
    annotations.value.push(annotation)
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>) {
    const index = annotations.value.findIndex(a => a.id === id)
    if (index !== -1) {
      annotations.value[index] = { ...annotations.value[index], ...updates }
    }
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

  function selectAnnotation(id: string | null) {
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

  function setAnnotations(newAnnotations: Annotation[]) {
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
    const { data } = await $fetch<{ data: any[] }>('/api/annotations/fetch', {
      method: 'POST',
      body: { documentSlug: documentUrl },
    })

    // Data is already in the right format - NO DENORMALIZATION!
    annotations.value = data.map(item => item.data as Annotation)
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
  }
})
