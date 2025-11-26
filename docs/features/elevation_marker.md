# Elevation Marker

## Priority
**Medium** - Very Useful

## Status
⏳ Planned

## Description
Mark heights/elevations on sections with triangle or circle symbols containing elevation text.

## Use Cases
- Mark floor levels
- Show ceiling heights
- Indicate datum points
- Reference levels on sections

## Features

### Core Functionality
- Triangle or circle symbol with text
- Standard elevation format ("+2.4m", "RL 100.0")
- Horizontal leader line option

### Symbol Styles
- Triangle (pointing up/down)
- Circle with crosshairs
- Diamond
- Rectangle

### Display Options
- Above/below datum reference
- Relative or absolute values
- Prefix text (RL, FL, SSL, etc.)
- Unit suffix

## Implementation Notes

### Data Structure
```typescript
interface ElevationAnnotation {
  id: string
  type: 'elevation'
  pageNum: number
  position: Point
  value: number
  prefix: string           // e.g., "RL", "FL", "SSL"
  symbol: 'triangle-up' | 'triangle-down' | 'circle' | 'diamond'
  showSign: boolean        // Show +/- prefix
  unit: string
  color: string
}
```

### Standard Prefixes
```typescript
const ELEVATION_PREFIXES = {
  RL: 'Reduced Level',
  FL: 'Floor Level',
  SSL: 'Structural Slab Level',
  TOC: 'Top of Concrete',
  TOW: 'Top of Wall',
  FFL: 'Finished Floor Level'
}
```

### UI Components
- Symbol marker at position
- Elevation text
- Optional leader line
- Prefix/value editor

## Priority Justification
Common notation in construction drawings. Essential for sections and elevations.
