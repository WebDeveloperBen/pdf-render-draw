import type { ModifierKeys, SupportedMeasurementUnits, TextStyle } from "~/types/tools"

// ============================================
// Type Definitions
// ============================================

interface CanvasSettings {
  cursorZoomIncrements: number
  minimumScaleSize: number
  maximumScaleSize: number
  annotationDefaultDistance: number // in PDF points
  zoomIncrementsForTrackPad: number
  zoomModifierKey: ModifierKeys
}

interface GeneralSettings {
  labelFontSize: number
  fontSpacing: number
  toolSnapDistance: number // in PDF points
  toolClickCloseThreshold: number // in milliseconds
  displayMeasurementValues: SupportedMeasurementUnits
  showAnnotations: boolean
  showAllCanvasObjects: boolean
  selectHighlightColor: string
  pdfScale: string // e.g., "1:100", "1:50"
}

interface MeasureToolSettings {
  labelColor: string
  strokeColor: string
  lineColor: string
  opacity: number
  strokeWidth: number
  labelSize: number
  labelStrokeStyle: TextStyle
}

interface AreaToolSettings {
  labelSize: number
  labelColor: string
  fillColor: string
  strokeColor: string
  strokeWidth: number
  opacity: number
  labelStrokeStyle: TextStyle
}

interface PerimeterToolSettings {
  labelColor: string
  strokeColor: string
  fillColor: string
  strokeWidth: number
  opacity: number
  labelSize: number
  labelStrokeStyle: TextStyle
}

interface LineToolSettings {
  strokeColor: string
  fillColor: string
  strokeWidth: number
  opacity: number
}

interface FillToolSettings {
  labelColor: string
  strokeColor: string
  fillColor: string
  opacity: number
  strokeWidth: number
}

interface TextToolSettings {
  fontSize: number
  color: string
}

// ============================================
// Store Definition
// ============================================

export const useSettingStore = defineStore("settings", () => {
  /**
   * State - Grouped by category
   */
  const canvas = ref<CanvasSettings>({
    cursorZoomIncrements: 0.25,
    minimumScaleSize: 0.2,
    maximumScaleSize: 5,
    annotationDefaultDistance: 15,
    zoomIncrementsForTrackPad: 0.25,
    zoomModifierKey: "ctrl",
  })

  const general = ref<GeneralSettings>({
    labelFontSize: 12,
    fontSpacing: 0.6,
    toolSnapDistance: 25,
    toolClickCloseThreshold: 250,
    displayMeasurementValues: "mm",
    showAnnotations: true,
    showAllCanvasObjects: false,
    selectHighlightColor: "blue",
    pdfScale: "1:100",
  })

  const measureTool = ref<MeasureToolSettings>({
    labelColor: "black",
    strokeColor: "black",
    lineColor: "#faad19",
    opacity: 0.2,
    strokeWidth: 1,
    labelSize: 8,
    labelStrokeStyle: "bold",
  })

  const areaTool = ref<AreaToolSettings>({
    labelSize: 10,
    labelColor: "black",
    fillColor: "#f05a24",
    strokeColor: "#f05a24",
    strokeWidth: 1,
    opacity: 0.2,
    labelStrokeStyle: "bold",
  })

  const perimeterTool = ref<PerimeterToolSettings>({
    labelColor: "green",
    strokeColor: "green",
    fillColor: "green",
    strokeWidth: 1,
    opacity: 0.2,
    labelSize: 10,
    labelStrokeStyle: "bold",
  })

  const lineTool = ref<LineToolSettings>({
    strokeColor: "blue",
    fillColor: "blue",
    strokeWidth: 3,
    opacity: 0.2,
  })

  const fillTool = ref<FillToolSettings>({
    labelColor: "black",
    strokeColor: "black",
    fillColor: "green",
    opacity: 0.3,
    strokeWidth: 1,
  })

  const textTool = ref<TextToolSettings>({
    fontSize: 16,
    color: "black",
  })

  /**
   * Computed - Readonly access to settings
   */
  const canvasSettings = computed(() => canvas.value)
  const generalSettings = computed(() => general.value)
  const measureToolSettings = computed(() => measureTool.value)
  const areaToolSettings = computed(() => areaTool.value)
  const perimeterToolSettings = computed(() => perimeterTool.value)
  const lineToolSettings = computed(() => lineTool.value)
  const fillToolSettings = computed(() => fillTool.value)
  const textToolSettings = computed(() => textTool.value)

  /**
   * Convenience getters for commonly used individual values
   */
  const toolSnapDistance = computed(() => general.value.toolSnapDistance)
  const getPdfScale = computed(() => general.value.pdfScale)

  /**
   * Actions - Update entire groups or individual properties
   */
  function updateCanvasSettings(updates: Partial<CanvasSettings>) {
    // Validate minimum scale
    if (updates.minimumScaleSize !== undefined && updates.minimumScaleSize < 0.2) {
      console.warn("Minimum scale size cannot be less than 0.2")
      return
    }
    canvas.value = { ...canvas.value, ...updates }
  }

  function updateGeneralSettings(updates: Partial<GeneralSettings>) {
    general.value = { ...general.value, ...updates }
  }

  function updateMeasureToolSettings(updates: Partial<MeasureToolSettings>) {
    measureTool.value = { ...measureTool.value, ...updates }
  }

  function updateAreaToolSettings(updates: Partial<AreaToolSettings>) {
    areaTool.value = { ...areaTool.value, ...updates }
  }

  function updatePerimeterToolSettings(updates: Partial<PerimeterToolSettings>) {
    perimeterTool.value = { ...perimeterTool.value, ...updates }
  }

  function updateLineToolSettings(updates: Partial<LineToolSettings>) {
    lineTool.value = { ...lineTool.value, ...updates }
  }

  function updateFillToolSettings(updates: Partial<FillToolSettings>) {
    fillTool.value = { ...fillTool.value, ...updates }
  }

  function updateTextToolSettings(updates: Partial<TextToolSettings>) {
    textTool.value = { ...textTool.value, ...updates }
  }

  // Convenience actions for commonly used settings
  function setPdfScale(scale: string) {
    general.value.pdfScale = scale
  }

  function toggleShowAnnotations() {
    general.value.showAnnotations = !general.value.showAnnotations
  }

  function toggleShowAllCanvasObjects() {
    general.value.showAllCanvasObjects = !general.value.showAllCanvasObjects
  }

  return {
    // Grouped settings (readonly via computed)
    canvasSettings,
    generalSettings,
    measureToolSettings,
    areaToolSettings,
    perimeterToolSettings,
    lineToolSettings,
    fillToolSettings,
    textToolSettings,

    // Convenience getters
    toolSnapDistance,
    getPdfScale,

    // Update methods
    updateCanvasSettings,
    updateGeneralSettings,
    updateMeasureToolSettings,
    updateAreaToolSettings,
    updatePerimeterToolSettings,
    updateLineToolSettings,
    updateFillToolSettings,
    updateTextToolSettings,

    // Convenience actions
    setPdfScale,
    toggleShowAnnotations,
    toggleShowAllCanvasObjects,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingStore, import.meta.hot))
}
