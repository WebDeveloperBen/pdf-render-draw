# Angle Tool

## Priority
**High** - Essential for Construction/Architecture

## Status
⏳ Planned

## Description
Measure angles between walls, roof slopes, corners using 3-point measurement.

## Use Cases
- Verify square corners (90°)
- Measure roof pitches
- Check diagonal cuts and miters
- Verify wall angles

## Features

### Core Functionality
- 3-point angle measurement (vertex + two rays)
- Display angle in degrees
- Arc visualization between rays

### Display Options
- Show complementary angle
- Show as fraction of circle
- Precision settings (decimal places)

### Snap Features
- Snap to common angles (45°, 90°, 180°)
- Snap to existing line endpoints

## Implementation Notes

### Data Structure
```typescript
interface AngleAnnotation {
  id: string
  type: 'angle'
  pageNum: number
  vertex: Point      // The corner point
  ray1End: Point     // End of first ray
  ray2End: Point     // End of second ray
  angle: number      // Calculated angle in radians
  color: string
}
```

### Calculation
```typescript
function calculateAngle(vertex: Point, p1: Point, p2: Point): number {
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y }
  const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const cross = v1.x * v2.y - v1.y * v2.x
  return Math.atan2(cross, dot)
}
```

### UI Components
- Three-click placement (vertex, ray1, ray2)
- Arc display showing measured angle
- Degree label positioned near vertex

## Priority Justification
Essential capability not commonly found in PDF viewers. High value for verifying construction geometry.
