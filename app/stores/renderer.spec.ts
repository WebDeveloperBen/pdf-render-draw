import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRendererStore } from './renderer'

describe('Renderer Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Scale Management', () => {
    it('should have default scale of 1', () => {
      const store = useRendererStore()
      expect(store.getScale).toBe(1)
    })

    it('should update scale', () => {
      const store = useRendererStore()
      store.setScale(1.5)
      expect(store.getScale).toBe(1.5)
    })

    it('should not allow scale below minimum', () => {
      const store = useRendererStore()
      store.setScale(0.05) // Below min of 0.1
      expect(store.getScale).toBeGreaterThanOrEqual(0.1)
    })

    it('should not allow scale above maximum', () => {
      const store = useRendererStore()
      store.setScale(10) // Above max of 5
      expect(store.getScale).toBeLessThanOrEqual(5)
    })

    it('should zoom in', () => {
      const store = useRendererStore()
      const initialScale = store.getScale
      store.zoomIn()
      expect(store.getScale).toBeGreaterThan(initialScale)
    })

    it('should zoom out', () => {
      const store = useRendererStore()
      store.setScale(2)
      const initialScale = store.getScale
      store.zoomOut()
      expect(store.getScale).toBeLessThan(initialScale)
    })

    it('should reset scale', () => {
      const store = useRendererStore()
      store.setScale(2.5)
      store.resetPageScale()
      expect(store.getScale).toBe(1)
    })
  })

  describe('Rotation Management', () => {
    it('should have default rotation of 0', () => {
      const store = useRendererStore()
      expect(store.rotation).toBe(0)
    })

    it('should update rotation', () => {
      const store = useRendererStore()
      store.setRotation(90)
      expect(store.rotation).toBe(90)
    })

    it('should normalize rotation to 0-360', () => {
      const store = useRendererStore()

      store.setRotation(450) // Should normalize to 90
      expect(store.rotation).toBe(90)

      store.setRotation(-90) // Should normalize to 270
      expect(store.rotation).toBe(270)
    })

    it('should get rotation getter', () => {
      const store = useRendererStore()
      store.setRotation(180)
      expect(store.getRotation).toBe(180)
    })
  })

  describe('Page Management', () => {
    it('should have default page of 1', () => {
      const store = useRendererStore()
      expect(store.currentPage).toBe(1)
      expect(store.getCurrentPage).toBe(1)
    })

    it('should update current page', () => {
      const store = useRendererStore()
      store.setCurrentPage(5)
      expect(store.currentPage).toBe(5)
      expect(store.getCurrentPage).toBe(5)
    })

    it('should not allow page below 1', () => {
      const store = useRendererStore()
      store.setCurrentPage(0)
      expect(store.currentPage).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Canvas Position', () => {
    it('should have default position of (0, 0)', () => {
      const store = useRendererStore()
      expect(store.canvasPos.scrollLeft).toBe(0)
      expect(store.canvasPos.scrollTop).toBe(0)
    })

    it('should update canvas position', () => {
      const store = useRendererStore()
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 200 })
      expect(store.canvasPos.scrollLeft).toBe(100)
      expect(store.canvasPos.scrollTop).toBe(200)
    })
  })

  describe('Canvas Size', () => {
    it('should have default size of (0, 0)', () => {
      const store = useRendererStore()
      expect(store.getCanvasSize.width).toBe(0)
      expect(store.getCanvasSize.height).toBe(0)
    })
  })

  describe('Transform Calculation', () => {
    it('should generate canvas transform string', () => {
      const store = useRendererStore()
      store.setScale(2)
      store.setRotation(45)
      store.setCanvasPos({ scrollLeft: 100, scrollTop: 50 })

      const transform = store.getCanvasTransform

      expect(transform).toContain('translate(100px, 50px)')
      expect(transform).toContain('scale(2)')
      expect(transform).toContain('rotate(45deg)')
    })

    it('should generate SVG transform string with offset', () => {
      const store = useRendererStore()
      store.setScale(1.5)
      store.setRotation(90)
      store.setCanvasPos({ scrollLeft: 50, scrollTop: 75 })

      const transform = store.getSvgTransform(10, 20)

      // getSvgTransform subtracts offsets: scrollLeft - offsetX
      expect(transform).toContain('translate(40px, 55px)') // 50-10, 75-20
      expect(transform).toContain('rotate(90deg)')
    })
  })

  describe('PDF Document', () => {
    it('should initialize with undefined DocumentProxy', () => {
      const store = useRendererStore()
      expect(store.getDocumentProxy).toBeUndefined()
    })

    it('should initialize with 0 total pages', () => {
      const store = useRendererStore()
      expect(store.getTotalPages).toBe(0)
    })

    it('should update total pages', () => {
      const store = useRendererStore()
      store.setTotalPages(10)
      expect(store.getTotalPages).toBe(10)
    })
  })
})
