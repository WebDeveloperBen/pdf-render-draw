# Scale Calibration Tool

## Priority
**Medium** - Very Useful

## Status
⏳ Planned

## Description
Set drawing scale by measuring a known distance. "This line is 10 meters" → calibrates entire drawing.

## Use Cases
- Calibrate when scale isn't labeled
- Recalibrate resized PDFs
- Work with scanned drawings
- Verify existing scale bars

## Features

### Core Functionality
- Draw line between two points
- Enter known real-world distance
- Calculate and apply scale factor
- Store per-page or per-document

### Calibration Modes
- Two-point calibration (default)
- Scale bar reference (click known scale bar)
- Manual entry (enter scale ratio directly)

### Verification
- Test calibration against known dimensions
- Show confidence indicator
- Allow recalibration

## Implementation Notes

### Data Structure
```typescript
interface ScaleCalibration {
  id: string
  pageNum: number
  referencePoints: [Point, Point]
  pdfDistance: number          // Distance in PDF units
  realWorldDistance: number    // User-entered distance
  unit: 'mm' | 'm' | 'ft' | 'in'
  scale: number               // Calculated: realWorld / pdf
  createdAt: string
}
```

### Scale Calculation
```typescript
function calculateScale(
  p1: Point,
  p2: Point,
  realDistance: number
): number {
  const pdfDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  return realDistance / pdfDistance
}
```

### UI Components
- Calibration line with endpoints
- Input dialog for known distance
- Unit selector
- Scale display in toolbar
- "Recalibrate" button

## Priority Justification
Solves major pain point when scale is unknown or drawings are resized.
