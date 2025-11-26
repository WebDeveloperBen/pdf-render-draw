# Wall Thickness Tool

## Priority
**Advanced** - Nice to Have

## Status
⏳ Planned

## Description
Quick measurement between parallel lines for wall/slab thickness checks.

## Use Cases
- Verify wall thickness
- Check slab depths
- Measure beam widths
- Quick parallel distance

## Features

### Core Functionality
- Click two parallel lines
- Auto-calculate perpendicular distance
- Works with existing PDF lines (advanced)

### Measurement Modes
- **Two-point**: Click points on each face
- **Perpendicular snap**: Auto-find perpendicular from first point
- **Line-to-line**: Select two existing lines (advanced)

### Display
- Measurement line (perpendicular)
- Thickness value
- Extension to surfaces

## Implementation Notes

### Data Structure
```typescript
interface ThicknessAnnotation {
  id: string
  type: 'thickness'
  pageNum: number
  point1: Point              // Point on first surface
  point2: Point              // Point on second surface
  color: string
}
```

### Perpendicular Snap
```typescript
function findPerpendicularPoint(
  origin: Point,
  lineStart: Point,
  lineEnd: Point
): Point {
  // Project origin onto line to find perpendicular intersection
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const t = ((origin.x - lineStart.x) * dx + (origin.y - lineStart.y) * dy) / (dx * dx + dy * dy)
  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  }
}
```

### Simple Implementation
Start with two-point mode (similar to Measure tool but:
- Shorter default style
- Oriented for thickness display
- Specific naming/labeling

### UI Components
- Two point markers
- Perpendicular measurement line
- Thickness label
- Optional helper guides

## Implementation Complexity
**Low** for basic mode (essentially Measure tool variant). **High** for line detection mode.

## Priority Justification
Can be achieved with Measure tool. Dedicated tool is convenience feature.
