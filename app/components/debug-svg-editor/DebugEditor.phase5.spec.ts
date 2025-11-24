/**
 * Unit Tests for Debug SVG Editor - Phase 5
 *
 * Tests scaling functionality with corner and edge handles
 * Following PLAN.md spec-driven approach
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DebugEditor from './DebugEditor.vue'

describe('Debug SVG Editor - Phase 5: Scaling', () => {
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

  describe('Scaling State', () => {
    it('should show scaling status in debug info', async () => {
      const wrapper = mount(DebugEditor)
      const debugInfo = wrapper.find('.debug-info')

      expect(debugInfo.text()).toContain('Scaling: No')
    })

    it('should display phase 5 or later title', () => {
      const wrapper = mount(DebugEditor)
      const title = wrapper.find('h2')

      // Component may be at Phase 5 or beyond
      expect(title.text()).toMatch(/Phase [5-9]/)
    })

    it('should show scale hint', () => {
      const wrapper = mount(DebugEditor)
      const hint = wrapper.find('.hint')

      expect(hint.text()).toContain('Drag scale handles to resize')
    })

    it('should update debug info status heading to Phase 5', () => {
      const wrapper = mount(DebugEditor)
      const statusHeading = wrapper.find('.debug-info h3')

      expect(statusHeading.text()).toMatch(/Phase [5-9] Status/)
    })
  })

  describe('Scale Handles', () => {
    it('should show 8 scale handles for single selection', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select a shape
      await shapes[0]!.trigger('click')

      const scaleHandles = wrapper.findAll('.scale-handle')
      expect(scaleHandles).toHaveLength(8)
    })

    it('should show 4 corner handles', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const nwHandle = wrapper.find('.nwse-resize')
      const seHandle = wrapper.findAll('.nwse-resize')[1]
      const neHandle = wrapper.find('.nesw-resize')
      const swHandle = wrapper.findAll('.nesw-resize')[1]

      expect(nwHandle.exists()).toBe(true)
      expect(seHandle?.exists()).toBe(true)
      expect(neHandle.exists()).toBe(true)
      expect(swHandle?.exists()).toBe(true)
    })

    it('should show 4 edge handles', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const nHandle = wrapper.find('.ns-resize')
      const sHandle = wrapper.findAll('.ns-resize')[1]
      const eHandle = wrapper.find('.ew-resize')
      const wHandle = wrapper.findAll('.ew-resize')[1]

      expect(nHandle.exists()).toBe(true)
      expect(sHandle?.exists()).toBe(true)
      expect(eHandle.exists()).toBe(true)
      expect(wHandle?.exists()).toBe(true)
    })

    it('should position corner handles at bounds corners', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      const bboxX = parseFloat(selectionBox.attributes('x') || '0')
      const bboxY = parseFloat(selectionBox.attributes('y') || '0')
      const bboxWidth = parseFloat(selectionBox.attributes('width') || '0')
      const bboxHeight = parseFloat(selectionBox.attributes('height') || '0')

      const nwHandle = wrapper.find('.nwse-resize')
      const nwX = parseFloat(nwHandle.attributes('x') || '0')
      const nwY = parseFloat(nwHandle.attributes('y') || '0')

      // NW handle should be at top-left corner (minus half handle size)
      expect(nwX).toBeCloseTo(bboxX - 4, 1)
      expect(nwY).toBeCloseTo(bboxY - 4, 1)
    })

    it('should position edge handles at bounds midpoints', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      const bboxX = parseFloat(selectionBox.attributes('x') || '0')
      const bboxY = parseFloat(selectionBox.attributes('y') || '0')
      const bboxWidth = parseFloat(selectionBox.attributes('width') || '0')

      const nHandle = wrapper.find('.ns-resize')
      const nX = parseFloat(nHandle.attributes('x') || '0')
      const nY = parseFloat(nHandle.attributes('y') || '0')

      // N handle should be at top center
      expect(nX).toBeCloseTo(bboxX + bboxWidth / 2 - 4, 1)
      expect(nY).toBeCloseTo(bboxY - 4, 1)
    })
  })

  describe('Scale State Management', () => {
    it('should have scaling state initialized to false', () => {
      const wrapper = mount(DebugEditor)

      expect(wrapper.vm.isScaling).toBe(false)
    })

    it('should have null scale handle initially', () => {
      const wrapper = mount(DebugEditor)

      expect(wrapper.vm.scaleHandle).toBeNull()
    })

    it('should have null scale start point initially', () => {
      const wrapper = mount(DebugEditor)

      expect(wrapper.vm.scaleStartPoint).toBeNull()
    })

    it('should have null scale original bounds initially', () => {
      const wrapper = mount(DebugEditor)

      expect(wrapper.vm.scaleOriginalBounds).toBeNull()
    })

    it('should have empty scale original shapes initially', () => {
      const wrapper = mount(DebugEditor)

      expect(wrapper.vm.scaleOriginalShapes.size).toBe(0)
    })
  })

  describe('Scale Interaction', () => {
    it('should start scaling on handle mousedown', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const seHandle = wrapper.findAll('.scale-handle')[1] // SE corner handle
      await seHandle!.trigger('mousedown')

      expect(wrapper.vm.isScaling).toBe(true)
    })

    it('should set correct scale handle on mousedown', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const nwHandle = wrapper.find('.nwse-resize')
      await nwHandle.trigger('mousedown')

      expect(wrapper.vm.scaleHandle).toBe('nw')
    })

    it('should maintain selection during scaling', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      expect(shapes[0]!.classes()).toContain('selected')

      const seHandle = wrapper.findAll('.scale-handle')[1]
      await seHandle!.trigger('mousedown')

      // Selection should still be active
      expect(shapes[0]!.classes()).toContain('selected')
    })

    it('should not allow scaling without selection', async () => {
      const wrapper = mount(DebugEditor)

      // No selection, so no scale handles should exist
      const scaleHandles = wrapper.findAll('.scale-handle')
      expect(scaleHandles).toHaveLength(0)
    })
  })

  describe('Multi-Select Scaling', () => {
    it('should allow scaling multi-select', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Multi-select
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const scaleHandles = wrapper.findAll('.scale-handle')
      expect(scaleHandles).toHaveLength(8)

      // Should be able to start scaling
      await scaleHandles[1]!.trigger('mousedown')
      expect(wrapper.vm.isScaling).toBe(true)
    })

    it('should show union bounds scale handles for multi-select', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const scaleHandles = wrapper.findAll('.scale-handle')

      expect(selectionBox.exists()).toBe(true)
      expect(scaleHandles).toHaveLength(8)
    })

    it('should position scale handles on union bounds', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const bboxX = parseFloat(selectionBox.attributes('x') || '0')
      const bboxY = parseFloat(selectionBox.attributes('y') || '0')

      const nwHandle = wrapper.find('.nwse-resize')
      const nwX = parseFloat(nwHandle.attributes('x') || '0')
      const nwY = parseFloat(nwHandle.attributes('y') || '0')

      // Should be positioned on union bounds
      expect(nwX).toBeCloseTo(bboxX - 4, 1)
      expect(nwY).toBeCloseTo(bboxY - 4, 1)
    })
  })

  describe('Phase Integration', () => {
    it('should preserve Phase 1 functionality', async () => {
      const wrapper = mount(DebugEditor)
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
      const wrapper = mount(DebugEditor)
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
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Drag still works
      const selectionBox = wrapper.find('.selection-box')
      await selectionBox.trigger('mousedown')

      expect(wrapper.vm.isDragging).toBe(true)
    })

    it('should preserve Phase 4 functionality', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Rotation still works
      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(true)

      await rotationHandle.trigger('mousedown')
      expect(wrapper.vm.isRotating).toBe(true)
    })

    it('should not drag, rotate, and scale simultaneously', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Start scaling
      const seHandle = wrapper.findAll('.scale-handle')[1]
      await seHandle!.trigger('mousedown')
      expect(wrapper.vm.isScaling).toBe(true)
      expect(wrapper.vm.isDragging).toBe(false)
      expect(wrapper.vm.isRotating).toBe(false)

      // Trigger global mouseup to end scale
      window.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isScaling).toBe(false)

      // Now start dragging
      const selectionBox = wrapper.find('.selection-box')
      await selectionBox.trigger('mousedown')
      expect(wrapper.vm.isDragging).toBe(true)
      expect(wrapper.vm.isScaling).toBe(false)
      expect(wrapper.vm.isRotating).toBe(false)
    })
  })

  describe('Scale Handle Cursors', () => {
    it('should have nwse-resize cursor on NW and SE handles', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const nwseHandles = wrapper.findAll('.nwse-resize')
      expect(nwseHandles).toHaveLength(2) // NW and SE corners
    })

    it('should have nesw-resize cursor on NE and SW handles', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const neswHandles = wrapper.findAll('.nesw-resize')
      expect(neswHandles).toHaveLength(2) // NE and SW corners
    })

    it('should have ns-resize cursor on N and S handles', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const nsHandles = wrapper.findAll('.ns-resize')
      expect(nsHandles).toHaveLength(2) // N and S edges
    })

    it('should have ew-resize cursor on E and W handles', async () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const ewHandles = wrapper.findAll('.ew-resize')
      expect(ewHandles).toHaveLength(2) // E and W edges
    })
  })
})
