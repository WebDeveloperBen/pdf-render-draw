# Grid Overlay

## Priority
**Advanced** - Nice to Have

## Status
⏳ Planned

## Description
Measurement grid with snap points for alignment verification.

## Use Cases
- Verify alignment
- Quick reference measurements
- Snap annotations to grid
- Structural grid overlay

## Features

### Core Functionality
- Overlay measurement grid
- Configurable spacing
- Snap points at grid intersections
- Toggle visibility

### Grid Types
- **Regular**: Equal spacing X and Y
- **Custom**: Different X and Y spacing
- **Structural**: Named grid lines (A, B, C... / 1, 2, 3...)

### Display Options
- Major/minor grid lines
- Grid line color and opacity
- Show measurements on edges
- Grid origin offset

### Snap Behavior
- Snap annotation points to grid
- Configurable snap distance
- Toggle snap on/off

## Implementation Notes

### Data Structure
```typescript
interface GridOverlay {
  id: string
  pageNum: number
  origin: Point               // Grid origin point
  spacingX: number           // Grid spacing in X
  spacingY: number           // Grid spacing in Y
  rotation: number           // Grid rotation
  color: string
  opacity: number
  showLabels: boolean
  majorInterval: number      // Every N lines is major
}
```

### Grid Rendering
```typescript
function renderGrid(
  grid: GridOverlay,
  viewportBounds: { width: number; height: number }
): SVGElement[] {
  // Calculate visible grid lines
  // Return array of line elements
}
```

### Snap Logic
```typescript
function snapToGrid(point: Point, grid: GridOverlay, snapDistance: number): Point {
  const nearestX = Math.round((point.x - grid.origin.x) / grid.spacingX) * grid.spacingX + grid.origin.x
  const nearestY = Math.round((point.y - grid.origin.y) / grid.spacingY) * grid.spacingY + grid.origin.y

  if (Math.hypot(nearestX - point.x, nearestY - point.y) < snapDistance) {
    return { x: nearestX, y: nearestY }
  }
  return point
}
```

### UI Components
- Grid configuration panel
- Spacing inputs
- Origin dragger
- Snap toggle
- Visibility toggle

## Implementation Complexity
**Medium** - Rendering is straightforward. Snap integration needs care.

## Priority Justification
Useful for alignment but not essential for basic annotation workflows.
