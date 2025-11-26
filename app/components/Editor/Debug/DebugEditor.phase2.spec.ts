/**
 * Unit Tests for Debug SVG Editor - Phase 2
 *
 * Tests multi-selection and union bounding box calculation
 * Following PLAN.md spec-driven approach
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SimpleDebugEditor from './SimpleDebugEditor.vue'

describe('Debug SVG Editor - Phase 2: Multi-Select', () => {
  describe('Multiple Shapes', () => {
    it('should render three hardcoded rectangles', () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      expect(shapes).toHaveLength(3)
    })

    it('should display phase title', () => {
      const wrapper = mount(SimpleDebugEditor)
      const title = wrapper.find('h2')

      expect(title.text()).toContain('Debug SVG Editor')
      expect(title.text()).toMatch(/Phase \d/)
    })

    it('should show multi-select hint', () => {
      const wrapper = mount(SimpleDebugEditor)
      const hint = wrapper.find('.hint')

      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('Shift+Click')
    })
  })

  describe('Shift+Click Multi-Select', () => {
    it('should select first shape on regular click', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      expect(shapes[0]!.classes()).toContain('selected')
      expect(shapes[1]!.classes()).not.toContain('selected')
      expect(shapes[2]!.classes()).not.toContain('selected')
    })

    it('should add second shape to selection with Shift+click', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select first shape
      await shapes[0]!.trigger('click')

      // Shift+click second shape
      await shapes[1]!.trigger('click', { shiftKey: true })

      expect(shapes[0]!.classes()).toContain('selected')
      expect(shapes[1]!.classes()).toContain('selected')
      expect(shapes[2]!.classes()).not.toContain('selected')
    })

    it('should allow selecting all three shapes', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })
      await shapes[2]!.trigger('click', { shiftKey: true })

      expect(shapes[0]!.classes()).toContain('selected')
      expect(shapes[1]!.classes()).toContain('selected')
      expect(shapes[2]!.classes()).toContain('selected')
    })

    it('should replace selection on regular click after multi-select', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Multi-select first two
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      // Regular click on third (should replace selection)
      await shapes[2]!.trigger('click')

      expect(shapes[0]!.classes()).not.toContain('selected')
      expect(shapes[1]!.classes()).not.toContain('selected')
      expect(shapes[2]!.classes()).toContain('selected')
    })

    it('should deselect shape with Shift+click if already selected', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // Select two shapes
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      // Shift+click first shape again (should deselect it)
      await shapes[0]!.trigger('click', { shiftKey: true })

      expect(shapes[0]!.classes()).not.toContain('selected')
      expect(shapes[1]!.classes()).toContain('selected')
    })

    it('should clear all selections on background click', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')
      const svg = wrapper.find('svg')

      // Multi-select all shapes
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })
      await shapes[2]!.trigger('click', { shiftKey: true })

      // Click background
      await svg.trigger('click')

      expect(shapes[0]!.classes()).not.toContain('selected')
      expect(shapes[1]!.classes()).not.toContain('selected')
      expect(shapes[2]!.classes()).not.toContain('selected')
    })
  })

  describe('Multi-Select Debug Info', () => {
    it('should show selected count', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toContain('Selected Count: 2')
    })

    it('should show selected IDs', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toContain('rect-1')
      expect(debugInfo).toContain('rect-2')
    })

    it('should show "None" when nothing is selected', () => {
      const wrapper = mount(SimpleDebugEditor)
      const debugInfo = wrapper.find('.debug-info').text()

      expect(debugInfo).toContain('Selected IDs: None')
    })
  })

  describe('Union Bounding Box', () => {
    it('should show selection box for single selection', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      expect(selectionBox.exists()).toBe(true)
    })

    it('should show union bounding box for two selections', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      expect(selectionBox.exists()).toBe(true)
    })

    it('should calculate correct union bounds for two shapes', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // rect-1: x=100, y=100, w=150, h=100
      // rect-2: x=350, y=200, w=120, h=80
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const x = parseFloat(selectionBox.attributes('x') || '0')
      const y = parseFloat(selectionBox.attributes('y') || '0')
      const width = parseFloat(selectionBox.attributes('width') || '0')
      const height = parseFloat(selectionBox.attributes('height') || '0')

      // Union should be from (100, 100) to (470, 280)
      expect(x).toBe(100)
      expect(y).toBe(100)
      expect(width).toBe(370) // 470 - 100
      expect(height).toBe(180) // 280 - 100
    })

    it('should calculate correct union bounds for all three shapes', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      // rect-1: x=100, y=100, w=150, h=100
      // rect-2: x=350, y=200, w=120, h=80
      // rect-3: x=200, y=350, w=100, h=100
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })
      await shapes[2]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const x = parseFloat(selectionBox.attributes('x') || '0')
      const y = parseFloat(selectionBox.attributes('y') || '0')
      const width = parseFloat(selectionBox.attributes('width') || '0')
      const height = parseFloat(selectionBox.attributes('height') || '0')

      // Union should encompass all three rectangles
      // Min: (100, 100), Max: (470, 450)
      expect(x).toBe(100)
      expect(y).toBe(100)
      expect(width).toBe(370) // 470 - 100
      expect(height).toBe(350) // 450 - 100
    })

    it('should show rotation handle for multi-select', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(true)
    })

    it('should position rotation handle above union bounds', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })

      const selectionBox = wrapper.find('.selection-box')
      const rotationHandle = wrapper.find('.rotation-handle')

      const bboxX = parseFloat(selectionBox.attributes('x') || '0')
      const bboxWidth = parseFloat(selectionBox.attributes('width') || '0')
      const bboxY = parseFloat(selectionBox.attributes('y') || '0')

      const handleCx = parseFloat(rotationHandle.attributes('cx') || '0')
      const handleCy = parseFloat(rotationHandle.attributes('cy') || '0')

      // Handle should be centered horizontally on union bounds
      expect(handleCx).toBeCloseTo(bboxX + bboxWidth / 2, 1)

      // Handle should be above union bounds
      expect(handleCy).toBeLessThan(bboxY)
    })
  })

  describe('Selection State Management', () => {
    it('should maintain selection state when clicking same shape again', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')

      await shapes[0]!.trigger('click')
      await shapes[0]!.trigger('click')

      expect(shapes[0]!.classes()).toContain('selected')
    })

    it('should allow building selection incrementally', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')
      const debugInfo = wrapper.find('.debug-info')

      await shapes[0]!.trigger('click')
      expect(debugInfo.text()).toContain('Selected Count: 1')

      await shapes[1]!.trigger('click', { shiftKey: true })
      expect(debugInfo.text()).toContain('Selected Count: 2')

      await shapes[2]!.trigger('click', { shiftKey: true })
      expect(debugInfo.text()).toContain('Selected Count: 3')
    })

    it('should allow removing shapes from selection', async () => {
      const wrapper = mount(SimpleDebugEditor)
      const shapes = wrapper.findAll('.shape')
      const debugInfo = wrapper.find('.debug-info')

      // Select all three
      await shapes[0]!.trigger('click')
      await shapes[1]!.trigger('click', { shiftKey: true })
      await shapes[2]!.trigger('click', { shiftKey: true })
      expect(debugInfo.text()).toContain('Selected Count: 3')

      // Deselect middle one
      await shapes[1]!.trigger('click', { shiftKey: true })
      expect(debugInfo.text()).toContain('Selected Count: 2')
      expect(shapes[1]!.classes()).not.toContain('selected')
    })
  })
})
