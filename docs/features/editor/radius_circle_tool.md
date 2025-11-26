# Radius/Circle Tool

## Priority
**High** - Essential for Construction/Architecture

## Status
⏳ Planned

## Description
Measure circular elements by clicking center + edge point.

## Use Cases
- Measure columns
- Measure curved walls
- Calculate pipe/duct sizes
- Verify turning radii

## Features

### Core Functionality
- Click center + edge point for circle definition
- Shows radius, diameter, circumference, and area
- Scale-aware measurements

### Display Options
- Toggle which measurements to show
- Customizable units
- Precision settings

### Drawing Modes
- Center-to-edge (default)
- 3-point arc (define circle from 3 points)
- Diameter mode (click two opposite points)

## Implementation Notes

### Data Structure
```typescript
interface CircleAnnotation {
  id: string
  type: 'circle'
  pageNum: number
  center: Point
  radius: number     // In PDF units
  color: string
  strokeWidth: number
}
```

### Calculations
```typescript
function getCircleMeasurements(radius: number, scale: number) {
  const scaledRadius = radius * scale
  return {
    radius: scaledRadius,
    diameter: scaledRadius * 2,
    circumference: 2 * Math.PI * scaledRadius,
    area: Math.PI * scaledRadius * scaledRadius
  }
}
```

### UI Components
- Circle outline
- Center point marker
- Measurement label (configurable content)
- Radius line from center to edge

## Priority Justification
Fills gap in measuring curved elements. Common need for columns, arcs, and rounded features.
