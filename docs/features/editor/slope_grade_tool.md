# Slope/Grade Tool

## Priority
**Medium** - Very Useful

## Status
⏳ Planned

## Description
Measure slope percentage or ratio for ramps, drainage, and roof pitch.

## Use Cases
- Verify ramp slopes (accessibility compliance)
- Check drainage grades
- Measure roof pitch
- Calculate fall direction

## Features

### Core Functionality
- Two-point measurement (high + low points)
- Calculate rise over run
- Display as ratio or percentage

### Display Formats
- Percentage (e.g., 8.33%)
- Ratio (e.g., 1:12)
- Degrees (e.g., 4.76°)
- Rise/Run explicit (e.g., "1m rise / 12m run")

### Visual Aids
- Arrow showing fall direction
- Rise and run dimension lines
- Slope angle arc

## Implementation Notes

### Data Structure
```typescript
interface SlopeAnnotation {
  id: string
  type: 'slope'
  pageNum: number
  highPoint: Point
  lowPoint: Point
  displayFormat: 'percent' | 'ratio' | 'degrees'
  showDimensions: boolean
  showArrow: boolean
  color: string
}
```

### Calculations
```typescript
function calculateSlope(highPoint: Point, lowPoint: Point, scale: number) {
  const rise = (highPoint.y - lowPoint.y) * scale  // Assuming Y is elevation
  const run = Math.abs(highPoint.x - lowPoint.x) * scale

  return {
    rise,
    run,
    percent: (rise / run) * 100,
    ratio: `1:${Math.round(run / rise)}`,
    degrees: Math.atan(rise / run) * (180 / Math.PI)
  }
}
```

### UI Components
- High/low point markers
- Slope line between points
- Measurement label (configurable format)
- Fall direction arrow
- Optional rise/run dimension lines

## Priority Justification
Essential for accessibility compliance (ramp slopes) and drainage verification.
