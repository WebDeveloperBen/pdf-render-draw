# Room Label Tool

## Priority
**Advanced** - Nice to Have

## Status
⏳ Planned

## Description
Auto-calculate enclosed areas with room name and area labels. Click room to get area.

## Use Cases
- Label rooms with names
- Auto-calculate room areas
- Generate room schedules
- Verify area calculations

## Features

### Core Functionality
- Click inside room → auto-calculate enclosed area
- Label with room name + area
- Boundary detection (or manual boundary definition)

### Room Data
- Room name
- Room number
- Calculated area
- Perimeter length
- Custom fields (finish type, occupancy, etc.)

### Schedule Integration
- Track all rooms in document
- Export room schedule
- Area summaries by floor/building

## Implementation Notes

### Data Structure
```typescript
interface RoomAnnotation {
  id: string
  type: 'room'
  pageNum: number
  boundary: Point[]            // Room boundary polygon
  labelPosition: Point         // Where label is placed
  name: string
  number?: string
  area: number                 // Calculated from boundary
  perimeter: number
  customFields?: Record<string, string>
}
```

### Area Calculation
Uses same polygon area algorithm as Area tool.

### Boundary Detection
Two modes:
1. **Manual**: User draws boundary
2. **Auto-detect**: Click inside enclosed space, algorithm finds walls (advanced - requires PDF content analysis)

### UI Components
- Room boundary outline
- Room label (name + area)
- Room schedule panel
- Boundary editing handles

## Implementation Complexity
**High** - Auto-detection requires PDF content analysis. Manual mode is simpler.

## Priority Justification
Useful for area takeoffs and room schedules, but can be approximated with Area tool.
