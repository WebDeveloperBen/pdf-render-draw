# Polyline Tool

## Priority
**Medium** - Very Useful

## Status
⏳ Planned

## Description
Connected line segments that don't close like a polygon. Measure wall runs, pipe routes, cable paths.

## Use Cases
- Measure wall runs
- Trace pipe routes
- Calculate cable paths
- Measure irregular boundaries that don't close

## Features

### Core Functionality
- Click to add points
- Shows total length and individual segments
- Double-click or Enter to finish
- Doesn't auto-close like polygon

### Display Options
- Show individual segment lengths
- Show cumulative distance at each point
- Show total length
- Toggle segment labels

### Editing
- Drag points to adjust
- Insert points mid-segment
- Delete individual points
- Extend from endpoints

## Implementation Notes

### Data Structure
```typescript
interface PolylineAnnotation {
  id: string
  type: 'polyline'
  pageNum: number
  points: Point[]
  showSegmentLengths: boolean
  showCumulativeLengths: boolean
  color: string
  strokeWidth: number
}
```

### Length Calculations
```typescript
function getPolylineMeasurements(points: Point[], scale: number) {
  const segments: number[] = []
  let total = 0

  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(
      points[i].x - points[i-1].x,
      points[i].y - points[i-1].y
    ) * scale
    segments.push(length)
    total += length
  }

  return { segments, total }
}
```

### UI Components
- Connected line segments
- Point markers (draggable)
- Segment length labels
- Total length display
- Add/remove point buttons

## Priority Justification
More flexible than closed polygon for measuring linear runs. Common need for MEP routing.
