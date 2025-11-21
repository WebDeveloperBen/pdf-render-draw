import type { ModifierKeys, SupportedMeasurementUnits, TextStyle } from "~/types/tools"

export const useSettingStore = defineStore("settings", () => {
  /**
   * State
   */

  //canvas
  const cursorZoomIncrements = ref<number>(0.25)
  const minimumCanvasScaleSize = ref<number>(0.2)
  const maximumCanvasScaleSize = ref<number>(5)
  const annotationDefaultDistance = ref<number>(15)
  const zoomIncrementsForTrackPad = ref<number>(0.25)
  const zoomModifierKey = ref<ModifierKeys>("ctrl")
  const pdfScale = ref<string>("1:100") // PDF drawing scale (e.g., 1:100, 1:50, 1:200)

  //General
  const labelFontSize = ref<number>(12)
  const fontSpacing = ref<number>(0.6)
  const toolSnapDistance = ref<number>(25)
  const toolClickCloseThreshold = ref<number>(250)
  const displayMeasurementValues = ref<SupportedMeasurementUnits>("mm")
  const showAnnotations = ref<boolean>(true)
  const showAllCanvasObjects = ref<boolean>(false)
  const selectHightLightColor = ref<string>("blue")

  //Measure Tool
  const measureLabelColor = ref<string>("black")
  const measureStrokeColor = ref<string>("black")
  const measureLineColor = ref<string>("#faad19")
  const measureOpacity = ref<number>(0.2)
  const measureStrokeWidth = ref<number>(1)
  const measureLabelSize = ref<number>(8)
  const measureLabelStrokeStyle = ref<TextStyle>("bold")

  //Fill Tool
  const fillLabelColor = ref<string>("black")
  const fillStrokeColor = ref<string>("black")
  const fillFillColor = ref<string>("green")
  const fillOpacity = ref<number>(0.3)
  const fillStrokeWidth = ref<number>(1)

  //Perimeter Tool
  const perimeterLabelColor = ref<string>("green")
  const perimeterStrokeColor = ref<string>("green")
  const perimeterFillColor = ref<string>("green")
  const perimeterStrokeWidth = ref<number>(1)
  const perimeterOpacity = ref<number>(0.2)
  const perimeterLabelSize = ref<number>(10)
  const perimeterLabelStrokeStyle = ref<TextStyle>("bold")

  //Line Tool
  const lineStrokeColor = ref<string>("blue")
  const lineFillColor = ref<string>("blue")
  const lineStrokeWidth = ref<number>(3)
  const lineOpacity = ref<number>(0.2)

  //Area Tool
  const areaLabelSize = ref<number>(10)
  const areaLabelColor = ref<string>("black")
  const areaFillColor = ref<string>("#f05a24")
  const areaLineColor = ref<string>("#f05a24")
  const areaLabelStrokeStyle = ref<TextStyle>("bold")
  const areaLineStrokeWidth = ref<number>(1)

  //Text Tool
  const textFontSize = ref<number>(16)
  const textColor = ref<string>("black")

  /**
   * Getters
   */

  const getMinimumCanvasScaleSize = computed(() => minimumCanvasScaleSize.value)
  const getCursorZoomIncrements = computed(() => cursorZoomIncrements.value)
  const getMaxCanvasScaleSize = computed(() => maximumCanvasScaleSize.value)
  const getAnnotationDefaultDistance = computed(() => annotationDefaultDistance.value)
  const getZoomIncrementsForTrackPad = computed(() => zoomIncrementsForTrackPad.value)
  const getZoomModifierKey = computed(() => zoomModifierKey.value)
  const getPdfScale = computed(() => pdfScale.value)
  const getLabelFontSize = computed(() => labelFontSize.value)
  const getFontSpacing = computed(() => fontSpacing.value)
  const getFillLabelColor = computed(() => fillLabelColor.value)
  const getFillStrokeColor = computed(() => fillStrokeColor.value)
  const getFillFillColor = computed(() => fillFillColor.value)
  const getFillOpacity = computed(() => fillOpacity.value)
  const getFillStrokeWidth = computed(() => fillStrokeWidth.value)
  const getToolSnapDistance = computed(() => toolSnapDistance.value)
  const getToolClickCloseThreshold = computed(() => toolClickCloseThreshold.value)
  const getDisplayMeasurementValues = computed(() => displayMeasurementValues.value)
  const getShowAnnotations = computed(() => showAnnotations.value)
  const getShowAllCanvasObjects = computed(() => showAllCanvasObjects.value)
  const getPerimeterLabelColor = computed(() => perimeterLabelColor.value)
  const getPerimeterStrokeColor = computed(() => perimeterStrokeColor.value)
  const getPerimeterFillColor = computed(() => perimeterFillColor.value)
  const getPerimeterStrokeWidth = computed(() => perimeterStrokeWidth.value)
  const getPerimeterOpacity = computed(() => perimeterOpacity.value)
  const getPerimeterLabelSize = computed(() => perimeterLabelSize.value)
  const getPerimeterLabelStrokeStyle = computed(() => perimeterLabelStrokeStyle.value)
  const getlineStrokeColor = computed(() => lineStrokeColor.value)
  const getlineFillColor = computed(() => lineFillColor.value)
  const getlineStrokeWidth = computed(() => lineStrokeWidth.value)
  const getlineOpacity = computed(() => lineOpacity.value)
  const getAreaLabelSize = computed(() => areaLabelSize.value)
  const getAreaLabelColor = computed(() => areaLabelColor.value)
  const getAreaFillColor = computed(() => areaFillColor.value)
  const getAreaLineColor = computed(() => areaLineColor.value)
  const getAreaLabelStrokeStyle = computed(() => areaLabelStrokeStyle.value)
  const getMeasureLabelColor = computed(() => measureLabelColor.value)
  const getMeasureStrokeColor = computed(() => measureStrokeColor.value)
  const getMeasureOpacity = computed(() => measureOpacity.value)
  const getMeasureLineColor = computed(() => measureLineColor.value)
  const getMeasureStrokeWidth = computed(() => measureStrokeWidth.value)
  const getMeasureLabelSize = computed(() => measureLabelSize.value)
  const getMeasureLabelStrokeStyle = computed(() => measureLabelStrokeStyle.value)
  const getAreaLineStrokeWidth = computed(() => areaLineStrokeWidth.value)
  const getTextFontSize = computed(() => textFontSize.value)
  const getTextColor = computed(() => textColor.value)
  const getSelectHightLightColor = computed(() => selectHightLightColor.value)

  /**
   * Actions
   */
  const setMinimumCanvasScaleSize = (n: number) => {
    if (n < 0.2) return
    minimumCanvasScaleSize.value = n
  }
  const setMaxCanvasScaleSize = (n: number) => {
    maximumCanvasScaleSize.value = n
  }
  const setCursorZoomIncrements = (n: number) => (cursorZoomIncrements.value = n)
  const setAnnotationDefaultDistance = (n: number) => (annotationDefaultDistance.value = n)
  const setCursorZoomIncrementsForTrackPad = (n: number) => (zoomIncrementsForTrackPad.value = n)
  const setZoomModifierKey = (key: ModifierKeys) => (zoomModifierKey.value = key)
  const setPdfScale = (scale: string) => (pdfScale.value = scale)
  const setLabelFontSize = (size: number) => (labelFontSize.value = size)
  const setFontSpacing = (size: number) => (fontSpacing.value = size)
  const setFillLabelColor = (color: string) => (fillLabelColor.value = color)
  const setFillStrokeColor = (color: string) => (fillStrokeColor.value = color)
  const setFillFillColor = (color: string) => (fillFillColor.value = color)
  const setFillOpacity = (opacity: number) => (fillOpacity.value = opacity)
  const setFillStrokeWidth = (width: number) => (fillStrokeWidth.value = width)
  const setToolSnapDistance = (distance: number) => (toolSnapDistance.value = distance)
  const setToolClickCloseThreshold = (distance: number) =>
    (toolClickCloseThreshold.value = distance)
  const setDisplayMeasurementValues = (unit: SupportedMeasurementUnits) =>
    (displayMeasurementValues.value = unit)
  const toggleShowAnnotations = () => (showAnnotations.value = !showAnnotations.value)
  const toggleShowAllCanvasObjects = () =>
    (showAllCanvasObjects.value = !showAllCanvasObjects.value)
  const setPerimeterLabelColor = (color: string) => (perimeterLabelColor.value = color)
  const setPerimeterStrokeColor = (color: string) => (perimeterStrokeColor.value = color)
  const setPerimeterFillColor = (color: string) => (perimeterFillColor.value = color)
  const setPerimeterStrokeWidth = (width: number) => (perimeterStrokeWidth.value = width)
  const setPerimeterOpacity = (opacity: number) => (perimeterOpacity.value = opacity)
  const setLineStrokeColor = (color: string) => (lineStrokeColor.value = color)
  const setLineFillColor = (color: string) => (lineFillColor.value = color)
  const setLineStrokeWidth = (width: number) => (lineStrokeWidth.value = width)
  const setLineOpacity = (opacity: number) => (lineOpacity.value = opacity)
  const setAreaLabelSize = (size: number) => (areaLabelSize.value = size)
  const setAreaLabelColor = (color: string) => (areaLabelColor.value = color)
  const setAreaLabelStrokeStyle = (style: TextStyle) => (areaLabelStrokeStyle.value = style)
  const setAreaFillColor = (color: string) => (areaFillColor.value = color)
  const setAreaLineColor = (color: string) => (areaLineColor.value = color)
  const setMeasureLabelColor = (color: string) => (measureLabelColor.value = color)
  const setMeasureStrokeColor = (color: string) => (measureStrokeColor.value = color)
  const setMeasureLineColor = (color: string) => (measureLineColor.value = color)
  const setMeasureOpacity = (opacity: number) => (measureOpacity.value = opacity)
  const setMeasureStrokeWidth = (width: number) => (measureStrokeWidth.value = width)
  const setMeasureLabelSize = (size: number) => (measureLabelSize.value = size)
  const setMeasureLabelStrokeStyle = (style: TextStyle) => (measureLabelStrokeStyle.value = style)
  const setPerimeterLabelSize = (size: number) => (perimeterLabelSize.value = size)
  const setPerimeterLabelStrokeStyle = (style: TextStyle) =>
    (perimeterLabelStrokeStyle.value = style)
  const setAreaLineStrokeWidth = (width: number) => (areaLineStrokeWidth.value = width)
  const setTextFontSize = (size: number) => (textFontSize.value = size)
  const setTextColor = (color: string) => (textColor.value = color)
  const setSelectHightLightColor = (color: string) => (selectHightLightColor.value = color)

  return {
    cursorZoomIncrements,
    getCursorZoomIncrements,
    setCursorZoomIncrements,
    minimumCanvasScaleSize,
    getMinimumCanvasScaleSize,
    setMinimumCanvasScaleSize,
    maximumCanvasScaleSize,
    getMaxCanvasScaleSize,
    setMaxCanvasScaleSize,
    annotationDefaultDistance,
    getAnnotationDefaultDistance,
    setAnnotationDefaultDistance,
    zoomIncrementsForTrackPad,
    getZoomIncrementsForTrackPad,
    setCursorZoomIncrementsForTrackPad,
    zoomModifierKey,
    getZoomModifierKey,
    setZoomModifierKey,
    pdfScale,
    getPdfScale,
    setPdfScale,
    labelFontSize,
    getLabelFontSize,
    setLabelFontSize,
    fontSpacing,
    getFontSpacing,
    setFontSpacing,
    fillLabelColor,
    getFillLabelColor,
    setFillLabelColor,
    fillStrokeColor,
    getFillStrokeColor,
    setFillStrokeColor,
    fillFillColor,
    getFillFillColor,
    setFillFillColor,
    fillOpacity,
    getFillOpacity,
    setFillOpacity,
    fillStrokeWidth,
    getFillStrokeWidth,
    setFillStrokeWidth,
    toolSnapDistance,
    getToolSnapDistance,
    setToolSnapDistance,
    toolClickCloseThreshold,
    getToolClickCloseThreshold,
    setToolClickCloseThreshold,
    displayMeasurementValues,
    getDisplayMeasurementValues,
    setDisplayMeasurementValues,
    showAnnotations,
    getShowAnnotations,
    toggleShowAnnotations,
    showAllCanvasObjects,
    getShowAllCanvasObjects,
    toggleShowAllCanvasObjects,
    perimeterLabelColor,
    getPerimeterLabelColor,
    setPerimeterLabelColor,
    perimeterStrokeColor,
    getPerimeterStrokeColor,
    setPerimeterStrokeColor,
    perimeterFillColor,
    getPerimeterFillColor,
    setPerimeterFillColor,
    perimeterStrokeWidth,
    getPerimeterStrokeWidth,
    setPerimeterStrokeWidth,
    perimeterOpacity,
    getPerimeterOpacity,
    setPerimeterOpacity,
    perimeterLabelSize,
    getPerimeterLabelSize,
    setPerimeterLabelSize,
    perimeterLabelStrokeStyle,
    getPerimeterLabelStrokeStyle,
    setPerimeterLabelStrokeStyle,
    areaLabelSize,
    getAreaLabelSize,
    setAreaLabelSize,
    areaLabelColor,
    getAreaLabelColor,
    setAreaLabelColor,
    areaLabelStrokeStyle,
    getAreaLabelStrokeStyle,
    setAreaLabelStrokeStyle,
    areaFillColor,
    getAreaFillColor,
    setAreaFillColor,
    areaLineColor,
    getAreaLineColor,
    setAreaLineColor,
    areaLineStrokeWidth,
    getAreaLineStrokeWidth,
    setAreaLineStrokeWidth,
    measureLabelColor,
    getMeasureLabelColor,
    setMeasureLabelColor,
    measureStrokeColor,
    getMeasureStrokeColor,
    setMeasureStrokeColor,
    measureOpacity,
    getMeasureOpacity,
    setMeasureOpacity,
    measureStrokeWidth,
    getMeasureStrokeWidth,
    setMeasureStrokeWidth,
    measureLabelSize,
    getMeasureLabelSize,
    setMeasureLabelSize,
    measureLabelStrokeStyle,
    getMeasureLabelStrokeStyle,
    setMeasureLabelStrokeStyle,
    measureLineColor,
    getMeasureLineColor,
    setMeasureLineColor,
    textFontSize,
    getTextFontSize,
    setTextFontSize,
    textColor,
    getTextColor,
    setTextColor,
    selectHightLightColor,
    getSelectHightLightColor,
    setSelectHightLightColor,
    lineStrokeColor,
    getlineStrokeColor,
    setLineStrokeColor,
    lineFillColor,
    getlineFillColor,
    setLineFillColor,
    lineStrokeWidth,
    getlineStrokeWidth,
    setLineStrokeWidth,
    lineOpacity,
    getlineOpacity,
    setLineOpacity,
  }
})
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingStore, import.meta.hot))
}
