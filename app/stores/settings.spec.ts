import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingStore } from './settings'

describe('Settings Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('PDF Scale', () => {
    it('should have default PDF scale of 1:100', () => {
      const store = useSettingStore()
      expect(store.getPdfScale).toBe('1:100')
    })

    it('should update PDF scale', () => {
      const store = useSettingStore()
      store.updateGeneralSettings({ pdfScale: '1:50' })
      expect(store.getPdfScale).toBe('1:50')
    })
  })

  describe('Measure Tool Settings', () => {
    it('should have default measure tool settings', () => {
      const store = useSettingStore()
      const settings = store.measureToolSettings

      expect(settings.labelSize).toBeDefined()
      expect(settings.labelColor).toBeDefined()
      expect(settings.strokeColor).toBeDefined()
      expect(settings.strokeWidth).toBeDefined()
    })

    it('should update measure tool settings', () => {
      const store = useSettingStore()

      store.updateMeasureToolSettings({
        labelSize: 20,
        labelColor: '#FF0000',
      })

      expect(store.measureToolSettings.labelSize).toBe(20)
      expect(store.measureToolSettings.labelColor).toBe('#FF0000')
    })
  })

  describe('Area Tool Settings', () => {
    it('should have default area tool settings', () => {
      const store = useSettingStore()
      const settings = store.areaToolSettings

      expect(settings.labelSize).toBeDefined()
      expect(settings.fillColor).toBeDefined()
      expect(settings.strokeColor).toBeDefined()
      expect(settings.opacity).toBeDefined()
    })

    it('should update area tool settings', () => {
      const store = useSettingStore()

      store.updateAreaToolSettings({
        opacity: 0.5,
        fillColor: '#FFFF00',
      })

      expect(store.areaToolSettings.opacity).toBe(0.5)
      expect(store.areaToolSettings.fillColor).toBe('#FFFF00')
    })
  })

  describe('Perimeter Tool Settings', () => {
    it('should have default perimeter tool settings', () => {
      const store = useSettingStore()
      const settings = store.perimeterToolSettings

      expect(settings.labelSize).toBeDefined()
      expect(settings.strokeColor).toBeDefined()
      expect(settings.strokeWidth).toBeDefined()
    })

    it('should update perimeter tool settings', () => {
      const store = useSettingStore()

      store.updatePerimeterToolSettings({
        strokeWidth: 3,
      })

      expect(store.perimeterToolSettings.strokeWidth).toBe(3)
    })
  })

  describe('Line Tool Settings', () => {
    it('should have default line tool settings', () => {
      const store = useSettingStore()
      const settings = store.lineToolSettings

      expect(settings.strokeColor).toBeDefined()
      expect(settings.strokeWidth).toBeDefined()
      expect(settings.opacity).toBeDefined()
    })

    it('should update line tool settings', () => {
      const store = useSettingStore()

      store.updateLineToolSettings({
        strokeColor: '#0000FF',
        strokeWidth: 4,
        opacity: 0.7,
      })

      expect(store.lineToolSettings.strokeColor).toBe('#0000FF')
      expect(store.lineToolSettings.strokeWidth).toBe(4)
      expect(store.lineToolSettings.opacity).toBe(0.7)
    })
  })

  describe('Fill Tool Settings', () => {
    it('should have default fill tool settings', () => {
      const store = useSettingStore()
      const settings = store.fillToolSettings

      expect(settings.fillColor).toBeDefined()
      expect(settings.opacity).toBeDefined()
    })

    it('should update fill tool settings', () => {
      const store = useSettingStore()

      store.updateFillToolSettings({
        fillColor: '#FF00FF',
        opacity: 0.3,
      })

      expect(store.fillToolSettings.fillColor).toBe('#FF00FF')
      expect(store.fillToolSettings.opacity).toBe(0.3)
    })
  })

  describe('Text Tool Settings', () => {
    it('should have default text tool settings', () => {
      const store = useSettingStore()
      const settings = store.textToolSettings

      expect(settings.fontSize).toBeDefined()
      expect(settings.color).toBeDefined()
    })

    it('should update text tool settings', () => {
      const store = useSettingStore()

      store.updateTextToolSettings({
        fontSize: 24,
        color: '#333333',
      })

      expect(store.textToolSettings.fontSize).toBe(24)
      expect(store.textToolSettings.color).toBe('#333333')
    })
  })

  describe('Snap Distance', () => {
    it('should have default snap distance', () => {
      const store = useSettingStore()
      expect(store.toolSnapDistance).toBeDefined()
      expect(store.toolSnapDistance).toBeGreaterThan(0)
    })

    it('should update snap distance', () => {
      const store = useSettingStore()

      store.updateGeneralSettings({ toolSnapDistance: 15 })
      expect(store.toolSnapDistance).toBe(15)
    })
  })

  describe('Canvas Settings', () => {
    it('should have default canvas settings', () => {
      const store = useSettingStore()
      const settings = store.canvasSettings

      expect(settings.cursorZoomIncrements).toBeDefined()
      expect(settings.minimumScaleSize).toBeDefined()
      expect(settings.maximumScaleSize).toBeDefined()
    })

    it('should update canvas settings', () => {
      const store = useSettingStore()

      store.updateCanvasSettings({
        cursorZoomIncrements: 0.5,
        maximumScaleSize: 10,
      })

      expect(store.canvasSettings.cursorZoomIncrements).toBe(0.5)
      expect(store.canvasSettings.maximumScaleSize).toBe(10)
    })

    it('should enforce minimum scale size validation', () => {
      const store = useSettingStore()

      // Try to set below minimum
      store.updateCanvasSettings({ minimumScaleSize: 0.1 })

      // Should not update (minimum is 0.2)
      expect(store.canvasSettings.minimumScaleSize).toBeGreaterThanOrEqual(0.2)
    })
  })
})
