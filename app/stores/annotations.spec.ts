import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnnotationStore } from './annotations'
import type { TextAnnotation, Measurement, Area, Perimeter, Point } from '~/types/annotations'

describe('Annotation Store', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())
  })

  describe('Page Filtering', () => {
    it('should filter annotations by page number', () => {
      const store = useAnnotationStore()

      const page1Text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Page 1 text',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      const page2Text: TextAnnotation = {
        id: 'text-2',
        type: 'text',
        pageNum: 2,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Page 2 text',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(page1Text)
      store.addAnnotation(page2Text)

      // Get annotations for page 1
      const page1Annotations = store.getAnnotationsByTypeAndPage('text', 1)
      expect(page1Annotations).toHaveLength(1)
      expect(page1Annotations[0]?.id).toBe('text-1')

      // Get annotations for page 2
      const page2Annotations = store.getAnnotationsByTypeAndPage('text', 2)
      expect(page2Annotations).toHaveLength(1)
      expect(page2Annotations[0]?.id).toBe('text-2')
    })

    it('should return empty array for page with no annotations', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Page 1 text',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)

      // Page 2 should have no annotations
      const page2Annotations = store.getAnnotationsByTypeAndPage('text', 2)
      expect(page2Annotations).toHaveLength(0)
    })

    it('should filter by both type and page', () => {
      const store = useAnnotationStore()

      const page1Text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Text',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      const page1Measure: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      store.addAnnotation(page1Text)
      store.addAnnotation(page1Measure)

      // Should only get text annotations
      const textAnnotations = store.getAnnotationsByTypeAndPage('text', 1)
      expect(textAnnotations).toHaveLength(1)
      expect(textAnnotations[0]?.type).toBe('text')

      // Should only get measure annotations
      const measureAnnotations = store.getAnnotationsByTypeAndPage('measure', 1)
      expect(measureAnnotations).toHaveLength(1)
      expect(measureAnnotations[0]?.type).toBe('measure')
    })
  })

  describe('Annotation CRUD Operations', () => {
    it('should add annotation', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)

      expect(store.annotations).toHaveLength(1)
      expect(store.annotations[0]?.id).toBe('text-1')
    })

    it('should update annotation', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)
      store.updateAnnotation('text-1', { content: 'Updated' })

      const updated = store.getAnnotationById('text-1') as TextAnnotation
      expect(updated.content).toBe('Updated')
    })

    it('should delete annotation', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)
      expect(store.annotations).toHaveLength(1)

      store.deleteAnnotation('text-1')
      expect(store.annotations).toHaveLength(0)
    })

    it('should get annotation by id', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)

      const found = store.getAnnotationById('text-1')
      expect(found).toBeDefined()
      expect(found?.id).toBe('text-1')
    })
  })

  describe('Selection', () => {
    it('should select annotation', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)
      store.selectAnnotation('text-1')

      expect(store.selectedAnnotationId).toBe('text-1')
      expect(store.selectedAnnotation?.id).toBe('text-1')
    })

    it('should deselect annotation', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      store.addAnnotation(text)
      store.selectAnnotation('text-1')
      expect(store.selectedAnnotationId).toBe('text-1')

      store.selectAnnotation(null)
      expect(store.selectedAnnotationId).toBeNull()
      expect(store.selectedAnnotation).toBeNull()
    })
  })

  describe('Derived Value Recalculation (Label Position Update)', () => {
    it('should recalculate distance and midpoint when measurement points are updated', () => {
      const store = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        distance: 3528, // Calculated distance at 1:100 scale (100 PDF points = 3528mm)
        midpoint: { x: 50, y: 0 }, // Original midpoint
        labelRotation: 0,
      }

      store.addAnnotation(measurement)

      // Simulate dragging the measurement to a new position (translate by +50, +50)
      const newPoints: [Point, Point] = [
        { x: 50, y: 50 },
        { x: 150, y: 50 },
      ]

      store.updateAnnotation(measurement.id, { points: newPoints })

      const updated = store.getAnnotationById(measurement.id) as Measurement

      // Distance should be recalculated but stay the same (same length line)
      expect(updated.distance).toBe(3528) // 100 PDF points at 1:100 scale

      // Midpoint should be updated to new position
      expect(updated.midpoint.x).toBe(100) // (50 + 150) / 2
      expect(updated.midpoint.y).toBe(50)  // (50 + 50) / 2
    })

    it('should recalculate area and center when area points are updated', () => {
      const store = useAnnotationStore()

      const area: Area = {
        id: 'area-1',
        type: 'area',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        area: 12.45, // Original area at 1:100 scale
        center: { x: 50, y: 50 }, // Original center
        labelRotation: 0,
      }

      store.addAnnotation(area)

      // Simulate dragging the area to a new position (translate by +50, +50)
      const newPoints: Point[] = [
        { x: 50, y: 50 },
        { x: 150, y: 50 },
        { x: 150, y: 150 },
        { x: 50, y: 150 },
      ]

      store.updateAnnotation(area.id, { points: newPoints })

      const updated = store.getAnnotationById(area.id) as Area

      // Area should stay the same (same size polygon)
      expect(updated.area).toBe(12.45)

      // Center should be updated to new position
      expect(updated.center.x).toBe(100) // (50 + 150 + 150 + 50) / 4
      expect(updated.center.y).toBe(100) // (50 + 50 + 150 + 150) / 4
    })

    it('should recalculate segments, totalLength, and center when perimeter points are updated', () => {
      const store = useAnnotationStore()

      const perimeter: Perimeter = {
        id: 'perimeter-1',
        type: 'perimeter',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        segments: [
          {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
            length: 3528,
            midpoint: { x: 50, y: 0 },
          },
          {
            start: { x: 100, y: 0 },
            end: { x: 100, y: 100 },
            length: 3528,
            midpoint: { x: 100, y: 50 },
          },
          {
            start: { x: 100, y: 100 },
            end: { x: 0, y: 0 },
            length: 4989, // Diagonal is longer
            midpoint: { x: 50, y: 50 },
          },
        ],
        totalLength: 12045,
        center: { x: 66.67, y: 33.33 },
        labelRotation: 0,
      }

      store.addAnnotation(perimeter)

      // Simulate dragging the perimeter to a new position (translate by +100, +100)
      const newPoints: Point[] = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
      ]

      store.updateAnnotation(perimeter.id, { points: newPoints })

      const updated = store.getAnnotationById(perimeter.id) as Perimeter

      // Total length should be recalculated but stay the same (same size polygon)
      expect(updated.totalLength).toBe(12045)

      // Center should be updated to new position
      expect(updated.center.x).toBeCloseTo(166.67, 1) // (100 + 200 + 200) / 3
      expect(updated.center.y).toBeCloseTo(133.33, 1) // (100 + 100 + 200) / 3

      // Segments should be recalculated with new positions
      expect(updated.segments).toHaveLength(3)
      expect(updated.segments[0].midpoint.x).toBe(150) // (100 + 200) / 2
      expect(updated.segments[0].midpoint.y).toBe(100) // (100 + 100) / 2
    })

    it('should not recalculate derived values when non-point properties are updated', () => {
      const store = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Test',
        fontSize: 16,
        color: '#000000',
        rotation: 0,
      }

      store.addAnnotation(text)

      // Update non-point property (content)
      store.updateAnnotation(text.id, { content: 'Updated' })

      const updated = store.getAnnotationById(text.id) as TextAnnotation

      // Text should be updated
      expect(updated.content).toBe('Updated')

      // Position should remain unchanged
      expect(updated.x).toBe(100)
      expect(updated.y).toBe(100)
    })
  })
})
