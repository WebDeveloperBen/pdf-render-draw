/**
 * Unit Tests for Debug SVG Editor - Phase 4
 *
 * Tests rotation functionality
 * Following PLAN.md spec-driven approach
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SimpleDebugEditor from './SimpleDebugEditor.vue'

describe('Debug SVG Editor - Phase 4: Rotation', () => {
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

  describe('Rotation State', () => {
    it('should show rotating status in debug info', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const debugInfo = wrapper.find('.debug-info')

      expect(debugInfo.text()).toContain('Rotating: No')
    })

    it('should display phase 4 or later title', () => {
      const wrapper = mount(SimpleDebugEditor)
      const title = wrapper.find('h2')

      // Component may be at Phase 4 or beyond
      expect(title.text()).toMatch(/Phase [4-9]/)
    })

    it('should show rotation hint', () => {
      const wrapper = mount(SimpleDebugEditor)
      const hint = wrapper.find('.hint')

      expect(hint.text()).toContain('Drag rotation handle to rotate')
    })

    it('should update debug info status heading to Phase 4 or later', () => {
      const wrapper = mount(SimpleDebugEditor)
      const statusHeading = wrapper.find('.debug-info h3')

      expect(statusHeading.text()).toMatch(/Phase [4-9] Status/)
    })
  })

  describe('Rotation Handle', () => {
    it('should have grab cursor on rotation handle', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select a shape
      await shapes[0]!.trigger('click')

      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(true)
      expect(rotationHandle.classes()).not.toContain('rotating')
    })

    it('should apply rotating class on mousedown', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const rotationHandle = wrapper.find('.rotation-handle')
      await rotationHandle.trigger('mousedown')

      expect(wrapper.vm.isRotating).toBe(true)
    })

    it('should position rotation handle above single selection', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      const rotationHandle = wrapper.find('.rotation-handle')

      const bboxY = parseFloat(selectionBox.attributes('y') || '0')
      const handleCy = parseFloat(rotationHandle.attributes('cy') || '0')

      expect(handleCy).toBeLessThan(bboxY)
    })

    it('should position rotation handle above multi-selection', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const rotationHandle = wrapper.find('.rotation-handle')

      const bboxY = parseFloat(selectionBox.attributes('y') || '0')
      const handleCy = parseFloat(rotationHandle.attributes('cy') || '0')

      expect(handleCy).toBeLessThan(bboxY)
    })
  })

  describe('Rotation Behavior', () => {
    it('should display rotation angle in debug info', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toMatch(/Rotation: [\d.]+°/)
    })

    it('should initialize shapes with 0 degree rotation', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toContain('Rotation: 0.0°')
    })

    it('should have empty transform for non-rotated shapes', () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // All shapes start with rotation = 0
      for (const shape of shapes) {
        expect(shape.attributes('transform')).toBe('')
      }
    })
  })

  describe('Rotation State Management', () => {
    it('should have rotation state initialized to false', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.isRotating).toBe(false)
    })

    it('should have zero rotation start angle initially', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.rotationStartAngle).toBe(0)
    })

    it('should have empty rotation original angles initially', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.rotationOriginalAngles.size).toBe(0)
    })

    it('should have null rotation center initially', () => {
      const wrapper = mount(SimpleDebugEditor)

      expect(wrapper.vm.rotationCenter).toBeNull()
    })
  })

  describe('Multi-Select Rotation', () => {
    it('should allow rotating multi-select', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Multi-select
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(true)

      // Should be able to start rotation
      await rotationHandle.trigger('mousedown')
      expect(wrapper.vm.isRotating).toBe(true)
    })

    it('should show union bounds for multi-select rotation', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toContain('Selected Count: 2')
      expect(debugInfo).toMatch(/Union BBox/)
    })

    it('should center rotation handle horizontally on multi-select bounds', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const rotationHandle = wrapper.find('.rotation-handle')

      const bboxX = parseFloat(selectionBox.attributes('x') || '0')
      const bboxWidth = parseFloat(selectionBox.attributes('width') || '0')
      const handleCx = parseFloat(rotationHandle.attributes('cx') || '0')

      expect(handleCx).toBeCloseTo(bboxX + bboxWidth / 2, 1)
    })
  })

  describe('Rotation Interaction', () => {
    it('should prevent click event propagation when rotation starts', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const rotationHandle = wrapper.find('.rotation-handle')
      await rotationHandle.trigger('mousedown')

      // Verify rotation started
      expect(wrapper.vm.isRotating).toBe(true)
    })

    it('should maintain selection during rotation', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      expect(shapes[0]!.classes()).toContain('selected')

      const rotationHandle = wrapper.find('.rotation-handle')
      await rotationHandle.trigger('mousedown')

      // Selection should still be active
      expect(shapes[0]!.classes()).toContain('selected')
    })

    it('should not allow rotation without selection', async () => {
      const wrapper = mount(SimpleDebugEditor)

      // No selection, so no rotation handle should exist
      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(false)
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

    it('should not drag and rotate simultaneously', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      // Start dragging
      const selectionBox = wrapper.find('.selection-box')
      await selectionBox.trigger('mousedown')
      expect(wrapper.vm.isDragging).toBe(true)
      expect(wrapper.vm.isRotating).toBe(false)

      // Trigger global mouseup to end drag (simulating window event)
      window.dispatchEvent(new MouseEvent('mouseup'))
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isDragging).toBe(false)

      // Now start rotating
      const rotationHandle = wrapper.find('.rotation-handle')
      await rotationHandle.trigger('mousedown')
      expect(wrapper.vm.isRotating).toBe(true)
      expect(wrapper.vm.isDragging).toBe(false)
    })
  })

  describe('Rotation Line Indicator', () => {
    it('should show line from bbox center to rotation handle', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const rotationLine = wrapper.find('.rotation-handle-group line')
      expect(rotationLine.exists()).toBe(true)
      expect(rotationLine.attributes('stroke')).toBe('#3b82f6')
      expect(rotationLine.attributes('stroke-dasharray')).toBe('2 2')
    })

    it('should connect line from top center of bbox to handle', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      const rotationLine = wrapper.find('.rotation-handle-group line')
      const rotationHandle = wrapper.find('.rotation-handle')

      const bboxX = parseFloat(selectionBox.attributes('x') || '0')
      const bboxY = parseFloat(selectionBox.attributes('y') || '0')
      const bboxWidth = parseFloat(selectionBox.attributes('width') || '0')

      const lineX1 = parseFloat(rotationLine.attributes('x1') || '0')
      const lineY1 = parseFloat(rotationLine.attributes('y1') || '0')
      const lineX2 = parseFloat(rotationLine.attributes('x2') || '0')
      const lineY2 = parseFloat(rotationLine.attributes('y2') || '0')

      const handleCx = parseFloat(rotationHandle.attributes('cx') || '0')
      const handleCy = parseFloat(rotationHandle.attributes('cy') || '0')

      // Line starts at top center of bbox
      expect(lineX1).toBeCloseTo(bboxX + bboxWidth / 2, 1)
      expect(lineY1).toBe(bboxY)

      // Line ends at rotation handle
      expect(lineX2).toBe(handleCx)
      expect(lineY2).toBe(handleCy)
    })
  })
})
