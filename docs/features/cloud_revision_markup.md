# Cloud Revision Markup

## Priority
**High** - Essential for Construction/Architecture

## Status
⏳ Planned

## Description
Industry standard for highlighting revisions with cloud-shaped boundaries around changed areas.

## Use Cases
- Mark revised areas on drawings
- Track changes between versions
- Highlight attention areas
- Standard construction document management

## Features

### Core Functionality
- Draw cloud-shaped boundaries (freeform or rectangle-based)
- Track revision numbers/dates
- Industry-standard appearance

### Revision Tracking
- Auto-increment revision numbers
- Date stamps
- Revision history per cloud
- Link to revision schedule

### Drawing Modes
- Freeform cloud (draw path)
- Rectangle cloud (click-drag rectangle, auto-cloud border)
- Polygon cloud (click points, auto-cloud border)

## Implementation Notes

### Data Structure
```typescript
interface CloudAnnotation {
  id: string
  type: 'cloud'
  pageNum: number
  points: Point[]          // Boundary points
  revisionNumber: string   // e.g., "Rev A", "1", "2.1"
  revisionDate: string     // ISO date
  description?: string     // What changed
  color: string
}
```

### Cloud Path Generation
```typescript
// Generate cloud bumps along a path
function generateCloudPath(points: Point[], bumpSize: number): string {
  // For each segment, generate arc bumps
  // Return SVG path string with alternating arcs
}
```

### UI Components
- Cloud boundary (bumpy border)
- Revision label (number/date)
- Optional description tooltip
- Revision management panel

## Priority Justification
Industry standard for construction document management. Essential for professional workflows.
