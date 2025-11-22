import { describe, it, expect } from "vitest"
import {
  isMeasurement,
  isArea,
  isPerimeter,
  isLine,
  isFill,
  isText,
  isValidPoint,
  validateAnnotation,
  type Measurement,
  type Area,
  type Perimeter,
  type Line,
  type Fill,
  type TextAnnotation
} from "./annotations"

describe("Annotation Type Guards", () => {
  describe("isMeasurement", () => {
    it("should return true for measurement annotation", () => {
      const measurement: Measurement = {
        id: "test",
        rotation: 0,
        type: "measure",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0
      }

      expect(isMeasurement(measurement)).toBe(true)
    })

    it("should return false for non-measurement annotation", () => {
      const area: Area = {
        id: "test",
        type: "area",
        pageNum: 1,
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        area: 5000,
        center: { x: 50, y: 50 },
        labelRotation: 0
      }

      expect(isMeasurement(area)).toBe(false)
    })
  })

  describe("isArea", () => {
    it("should return true for area annotation", () => {
      const area: Area = {
        id: "test",
        type: "area",
        pageNum: 1,
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        area: 5000,
        center: { x: 50, y: 50 },
        labelRotation: 0
      }

      expect(isArea(area)).toBe(true)
    })
  })

  describe("isPerimeter", () => {
    it("should return true for perimeter annotation", () => {
      const perimeter: Perimeter = {
        id: "test",
        type: "perimeter",
        rotation: 0,
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        segments: [],
        totalLength: 300,
        center: { x: 50, y: 50 },
        labelRotation: 0
      }

      expect(isPerimeter(perimeter)).toBe(true)
    })
  })

  describe("isLine", () => {
    it("should return true for line annotation", () => {
      const line: Line = {
        id: "test",
        rotation: 0,
        type: "line",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ]
      }

      expect(isLine(line)).toBe(true)
    })
  })

  describe("isFill", () => {
    it("should return true for fill annotation", () => {
      const fill: Fill = {
        id: "test",
        rotation: 0,
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        color: "#FF0000",
        opacity: 0.5
      }

      expect(isFill(fill)).toBe(true)
    })
  })

  describe("isText", () => {
    it("should return true for text annotation", () => {
      const text: TextAnnotation = {
        id: "test",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 200,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000000",
        rotation: 0
      }

      expect(isText(text)).toBe(true)
    })
  })
})

describe("Point Validation", () => {
  describe("isValidPoint", () => {
    it("should validate correct points", () => {
      expect(isValidPoint({ x: 0, y: 0 })).toBe(true)
      expect(isValidPoint({ x: 100, y: 200 })).toBe(true)
      expect(isValidPoint({ x: -50, y: -100 })).toBe(true)
    })

    it("should reject invalid points", () => {
      expect(isValidPoint(null)).toBe(false)
      expect(isValidPoint(undefined)).toBe(false)
      expect(isValidPoint({})).toBe(false)
      expect(isValidPoint({ x: 100 })).toBe(false)
      expect(isValidPoint({ y: 100 })).toBe(false)
      expect(isValidPoint({ x: "invalid", y: 100 })).toBe(false)
      expect(isValidPoint({ x: 100, y: "invalid" })).toBe(false)
      expect(isValidPoint({ x: NaN, y: 100 })).toBe(false)
      expect(isValidPoint({ x: 100, y: NaN })).toBe(false)
    })
  })
})

describe("Annotation Validation", () => {
  describe("validateAnnotation", () => {
    it("should validate measurement annotation", () => {
      const measurement: Measurement = {
        id: "test",
        type: "measure",
        rotation: 0,
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0
      }

      expect(validateAnnotation(measurement)).toBe(true)
    })

    it("should validate area annotation", () => {
      const area: Area = {
        id: "test",
        type: "area",
        pageNum: 1,
        rotation: 0,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 }
        ],
        area: 5000,
        center: { x: 50, y: 50 },
        labelRotation: 0
      }

      expect(validateAnnotation(area)).toBe(true)
    })

    it("should validate text annotation with rotation", () => {
      const text: TextAnnotation = {
        id: "test",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 200,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000000",
        rotation: 90
      }

      expect(validateAnnotation(text)).toBe(true)
    })

    it("should reject annotation without id", () => {
      const invalid = {
        type: "measure",
        pageNum: 1
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })

    it("should reject annotation without type", () => {
      const invalid = {
        id: "test",
        pageNum: 1
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })

    it("should reject annotation with invalid pageNum", () => {
      const invalid = {
        id: "test",
        type: "measure",
        pageNum: 0 // Must be >= 1
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })

    it("should reject measurement with wrong number of points", () => {
      const invalid = {
        id: "test",
        type: "measure",
        pageNum: 1,
        points: [{ x: 0, y: 0 }], // Should have exactly 2
        distance: 0,
        midpoint: { x: 0, y: 0 }
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })

    it("should reject area with fewer than 3 points", () => {
      const invalid = {
        id: "test",
        type: "area",
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 }
        ], // Need at least 3
        area: 0,
        center: { x: 0, y: 0 }
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })

    it("should reject text annotation without rotation", () => {
      const invalid = {
        id: "test",
        type: "text",
        pageNum: 1,
        x: 100,
        y: 200,
        width: 200,
        height: 50,
        content: "Test",
        fontSize: 16,
        color: "#000000"
        // Missing rotation field
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })

    it("should reject fill with invalid opacity", () => {
      const invalid = {
        id: "test",
        type: "fill",
        pageNum: 1,
        x: 100,
        y: 200,
        color: "#FF0000",
        opacity: 1.5 // Must be 0-1
      }

      expect(validateAnnotation(invalid)).toBe(false)
    })
  })
})
