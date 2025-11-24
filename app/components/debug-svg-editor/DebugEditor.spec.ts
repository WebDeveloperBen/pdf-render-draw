/**
 * Unit Tests for Debug SVG Editor - Phase 1
 *
 * Tests basic selection and bounding box calculation
 * Following PLAN.md spec-driven approach
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DebugEditor from './DebugEditor.vue'

describe('Debug SVG Editor - Phase 1: Basic Selection', () => {
  describe('Initial State', () => {
    it('should render hardcoded rectangles', () => {
      const wrapper = mount(DebugEditor)
      const shapes = wrapper.findAll('.shape')

      expect(shapes.length).toBeGreaterThanOrEqual(1)
    })

    it('should have no selection initially', () => {
      const wrapper = mount(DebugEditor)
      const selectionBox = wrapper.find('.selection-box')

      expect(selectionBox.exists()).toBe(false)
    })

    it('should display phase title', () => {
      const wrapper = mount(DebugEditor)
      const title = wrapper.find('h2')

      expect(title.text()).toContain('Debug SVG Editor')
      expect(title.text()).toMatch(/Phase \d/)
    })
  })

  describe('Single Selection', () => {
    it('should select shape when clicked', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      await shape.trigger('click')

      expect(shape.classes()).toContain('selected')
    })

    it('should show selection box when shape is selected', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      await shape.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      expect(selectionBox.exists()).toBe(true)
    })

    it('should show rotation handle when shape is selected', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      await shape.trigger('click')

      const rotationHandle = wrapper.find('.rotation-handle')
      expect(rotationHandle.exists()).toBe(true)
    })

    it('should clear selection when background is clicked', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')
      const svg = wrapper.find('svg')

      // Select shape
      await shape.trigger('click')
      expect(wrapper.find('.selection-box').exists()).toBe(true)

      // Click background
      await svg.trigger('click')
      expect(wrapper.find('.selection-box').exists()).toBe(false)
    })

    it('should update debug info when shape is selected', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      await shape.trigger('click')

      const debugInfo = wrapper.find('.debug-info').text()
      expect(debugInfo).toContain('Selected')
      expect(debugInfo).toContain('Position:')
      expect(debugInfo).toContain('Size:')
      expect(debugInfo).toContain('Rotation:')
      expect(debugInfo).toMatch(/BBox/)
    })
  })

  describe('Bounding Box Calculation', () => {
    it('should calculate correct bounds for non-rotated rectangle', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      await shape.trigger('click')

      const selectionBox = wrapper.find('.selection-box')
      const x = parseFloat(selectionBox.attributes('x') || '0')
      const y = parseFloat(selectionBox.attributes('y') || '0')
      const width = parseFloat(selectionBox.attributes('width') || '0')
      const height = parseFloat(selectionBox.attributes('height') || '0')

      // Hardcoded shape is at (100, 100) with size 150x100
      expect(x).toBe(100)
      expect(y).toBe(100)
      expect(width).toBe(150)
      expect(height).toBe(100)
    })

    it('should position rotation handle above bounding box', async () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      await shape.trigger('click')

      const rotationHandle = wrapper.find('.rotation-handle')
      const cx = parseFloat(rotationHandle.attributes('cx') || '0')
      const cy = parseFloat(rotationHandle.attributes('cy') || '0')

      // Should be centered horizontally on bounding box
      expect(cx).toBe(100 + 150 / 2) // x + width/2 = 175

      // Should be above bounding box
      expect(cy).toBeLessThan(100) // Less than y position
    })
  })

  describe('SVG Transform', () => {
    it('should have no transform for non-rotated shape', () => {
      const wrapper = mount(DebugEditor)
      const shape = wrapper.find('.shape')

      const transform = shape.attributes('transform')
      expect(transform).toBe('')
    })
  })

  describe('Component Structure', () => {
    it('should have SVG canvas with correct viewBox', () => {
      const wrapper = mount(DebugEditor)
      const svg = wrapper.find('svg')

      expect(svg.attributes('viewBox')).toBe('0 0 800 600')
    })

    it('should have grid pattern background', () => {
      const wrapper = mount(DebugEditor)
      const pattern = wrapper.find('#grid')

      expect(pattern.exists()).toBe(true)
    })

    it('should have debug info panel', () => {
      const wrapper = mount(DebugEditor)
      const debugInfo = wrapper.find('.debug-info')

      expect(debugInfo.exists()).toBe(true)
      expect(debugInfo.find('h3').text()).toMatch(/Phase \d+ Status/)
    })
  })
})
