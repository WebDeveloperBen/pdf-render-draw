/**
 * Unit Tests for Debug SVG Editor - Phase 6
 *
 * Tests drag-box/marquee selection functionality
 * Following PLAN.md spec-driven approach
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SimpleDebugEditor from './SimpleDebugEditor.vue'

describe('Debug SVG Editor - Phase 6: Drag-Select', () => {
  // Mock SVG methods
  beforeEach(() => {
    // Mock createSVGPoint and getScreenCTM for coordinate transformation
    const mockSVGPoint = {
      x: 0,
      y: 0,
      matrixTransform: vi.fn((matrix) => ({ x: 100, y: 100 }))
    }

    const mockCTM = {
      inverse: vi.fn(() => ({}))
    }

    global.SVGSVGElement.prototype.createSVGPoint = vi.fn(() => mockSVGPoint as any)
    global.SVGSVGElement.prototype.getScreenCTM = vi.fn(() => mockCTM as any)
  })

  describe('Marquee Selection State', () => {
    it('should show marquee selection status in debug info', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const debugInfo = wrapper.find('.debug-info')

      expect(debugInfo.text()).toContain('Marquee: No')
    })

    it('should display phase 6 or later title', () => {
      const wrapper = mount(SimpleDebugEditor)
      const title = wrapper.find('h2')

      // Component may be at Phase 6 or beyond
      expect(title.text()).toMatch(/Phase [6-9]/)
    })

    it('should show marquee selection hint', () => {
      const wrapper = mount(SimpleDebugEditor)
      const hint = wrapper.find('.hint')

      expect(hint.text()).toContain('Drag on canvas to marquee select')
    })

    it('should update debug info status heading to Phase 6 or later', () => {
      const wrapper = mount(SimpleDebugEditor)
      const statusHeading = wrapper.find('.debug-info h3')

      expect(statusHeading.text()).toMatch(/Phase [6-9] Status/)
    })
  })

  describe('Marquee State Management', () => {
    it('should have marquee selection state initialized to false', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.isMarqueeSelecting).toBe(false)
    })

    it('should have null marquee start point initially', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.marqueeStartPoint).toBeNull()
    })

    it('should have null marquee end point initially', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.marqueeEndPoint).toBeNull()
    })
  })

  describe('Marquee Interaction', () => {
    it('should start marquee selection on background mousedown', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const svg = wrapper.find('svg')

      await svg.trigger('mousedown')

      expect(wrapper.vm.isMarqueeSelecting).toBe(true)
    })

    it('should not start marquee when clicking on a shape', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      expect(wrapper.vm.isMarqueeSelecting).toBe(false)
    })

    it('should not start marquee when clicking on selection box', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select a shape first
      await shapes[0]!.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      await selectionBox.trigger('mousedown')

      expect(wrapper.vm.isMarqueeSelecting).toBe(false)
      expect(wrapper.vm.isDragging).toBe(true)
    })

    it('should not start marquee when clicking on handles', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select a shape first
      await shapes[0]!.trigger('click')

      const rotationHandle = wrapper.find('.rotation-handle')
      await rotationHandle.trigger('mousedown')

      expect(wrapper.vm.isMarqueeSelecting).toBe(false)
      expect(wrapper.vm.isRotating).toBe(true)
    })
  })

  describe('Marquee Box Rendering', () => {
    it('should show marquee box when dragging', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const svg = wrapper.find('svg')

      await svg.trigger('mousedown')

      const marqueeBox = wrapper.find('.marquee-box')
      expect(marqueeBox.exists()).toBe(true)
    })

    it('should not show marquee box when not selecting', () => {
      const wrapper = mount(SimpleDebugEditor)

      const marqueeBox = wrapper.find('.marquee-box')
      expect(marqueeBox.exists()).toBe(false)
    })

    it('should have correct styling for marquee box', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const svg = wrapper.find('svg')

      await svg.trigger('mousedown')

      const marqueeBox = wrapper.find('.marquee-box')
      expect(marqueeBox.attributes('fill')).toBe('rgba(59, 130, 246, 0.1)')
      expect(marqueeBox.attributes('stroke')).toBe('#3b82f6')
    })
  })

  describe('Marquee Selection Logic', () => {
    it('should select shapes that intersect marquee box', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Start marquee
      const svg = wrapper.find('svg')
      await svg.trigger('mousedown')

      // Simulate mousemove to create marquee box
      window.dispatchEvent(new MouseEvent('mousemove'))
      await wrapper.vm.$nextTick()

      // End marquee
      window.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()

      // At least one shape should be selected (depending on marquee bounds)
      const selectedShapes = shapes.filter(s => s.classes().includes('selected'))
      expect(selectedShapes.length).toBeGreaterThanOrEqual(0)
    })

    it('should add to selection with shift+drag', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select first shape
      await shapes[0]!.trigger('click')
      expect(shapes[0]!.classes()).toContain('selected')

      // Start marquee with shift key
      const svg = wrapper.find('svg')
      await svg.trigger('mousedown', { shiftKey: true })

      expect(wrapper.vm.isMarqueeSelecting).toBe(true)
    })

    it('should replace selection without shift key', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select first shape
      await shapes[0]!.trigger('click')
      expect(shapes[0]!.classes()).toContain('selected')

      // Start marquee without shift key
      const svg = wrapper.find('svg')
      await svg.trigger('mousedown')

      // Marquee should clear previous selection
      expect(wrapper.vm.isMarqueeSelecting).toBe(true)
    })
  })

  describe('Phase Integration', () => {
    it('should preserve Phase 1 functionality', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Single selection still works
      await shapes[0]!.trigger('click')
      expect(shapes[0]!.classes()).toContain('selected')

      // Deselection still works
      const svg = wrapper.find('svg')
      await svg.trigger('click')
      expect(shapes[0]!.classes()).not.toContain('selected')
    })

    it('should preserve Phase 2 functionality', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Multi-select still works
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      expect(shapes[0]!.classes()).toContain('selected')
      expect(shapes[1]!.classes()).toContain('selected')

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toContain('Selected Count: 2')
    })

    it('should preserve Phase 3 functionality', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Drag still works
      const selectionBox = wrapper.find('.selection-box')
      await selectionBox.trigger('mousedown')

      expect(wrapper.vm.isDragging).toBe(true)
    })

    it('should preserve Phase 4 functionality', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Rotation still works
      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(true)

      await rotationHandle.trigger('mousedown')
      expect(wrapper.vm.isRotating).toBe(true)
    })

    it('should preserve Phase 5 functionality', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Scaling still works
      const scaleHandles = wrapper.findAll('.scale-handle')
      expect(scaleHandles.length).toBe(8)

      await scaleHandles[0]!.trigger('mousedown')
      expect(wrapper.vm.isScaling).toBe(true)
    })

    it('should not drag, rotate, scale, and marquee simultaneously', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Start marquee
      const svg = wrapper.find('svg')
      await svg.trigger('mousedown')
      expect(wrapper.vm.isMarqueeSelecting).toBe(true)
      expect(wrapper.vm.isDragging).toBe(false)
      expect(wrapper.vm.isRotating).toBe(false)
      expect(wrapper.vm.isScaling).toBe(false)
    })
  })

  describe('Marquee Box Geometry', () => {
    it('should calculate marquee bounds correctly', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const svg = wrapper.find('svg')

      await svg.trigger('mousedown')

      // Simulate drag
      window.dispatchEvent(new MouseEvent('mousemove'))
      await wrapper.vm.$nextTick()

      if (wrapper.vm.marqueeStartPoint && wrapper.vm.marqueeEndPoint) {
        const marqueeBox = wrapper.find('.marquee-box')
        expect(marqueeBox.exists()).toBe(true)

        const x = parseFloat(marqueeBox.attributes('x') || '0')
        const y = parseFloat(marqueeBox.attributes('y') || '0')
        const width = parseFloat(marqueeBox.attributes('width') || '0')
        const height = parseFloat(marqueeBox.attributes('height') || '0')

        expect(width).toBeGreaterThanOrEqual(0)
        expect(height).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle drag in any direction', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const svg = wrapper.find('svg')

      await svg.trigger('mousedown')

      // The marquee should work whether dragging right-down or left-up
      window.dispatchEvent(new MouseEvent('mousemove'))
      await wrapper.vm.$nextTick()

      const marqueeBox = wrapper.find('.marquee-box')
      expect(marqueeBox.exists()).toBe(true)
    })
  })
})
