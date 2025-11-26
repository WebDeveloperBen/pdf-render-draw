# Volume Calculator

## Priority
**Advanced** - Nice to Have

## Status
⏳ Planned

## Description
3D estimation tool for excavation, concrete pours. Input depth/height → calculates cubic meters.

## Use Cases
- Excavation quantities
- Concrete pour estimates
- Fill material calculations
- Earthwork takeoffs

## Features

### Core Functionality
- Based on area measurement
- Input depth/height
- Calculate cubic volume
- Scale-aware

### Volume Types
- **Prismatic**: Area × height (simple)
- **Tapered**: (Top area + Bottom area + √(Top × Bottom)) × height / 3
- **Average End Area**: (Area1 + Area2) / 2 × length

### Display Options
- Show base area
- Show depth/height
- Show calculated volume
- Unit conversion

## Implementation Notes

### Data Structure
```typescript
interface VolumeAnnotation {
  id: string
  type: 'volume'
  pageNum: number
  baseArea: Point[]           // Polygon defining base
  depth: number              // User-entered depth
  volumeType: 'prismatic' | 'tapered' | 'averageEndArea'
  topArea?: Point[]          // For tapered volumes
  color: string
}
```

### Volume Calculations
```typescript
function calculateVolume(
  baseArea: number,
  depth: number,
  volumeType: string,
  topArea?: number
): number {
  switch (volumeType) {
    case 'prismatic':
      return baseArea * depth
    case 'tapered':
      if (!topArea) throw new Error('Top area required for tapered')
      return (baseArea + topArea + Math.sqrt(baseArea * topArea)) * depth / 3
    default:
      return baseArea * depth
  }
}
```

### UI Components
- Area boundary (from Area tool or new)
- Depth input field
- Volume type selector
- Results display
- Unit selector (m³, yd³, etc.)

## Implementation Complexity
**Low** - Simple extension of Area tool with depth input.

## Priority Justification
Useful for earthwork estimates but can be calculated externally from area measurements.
