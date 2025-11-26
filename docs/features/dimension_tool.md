# Dimension Tool

## Priority
**High** - Essential for Construction/Architecture

## Status
⏳ Planned

## Description
Proper architectural dimension style with extension lines, dimension line, and text.

## Use Cases
- Add formal dimensions to unmarked drawings
- Verify existing dimensions
- Create takeoff markups
- Professional-quality annotations

## Features

### Core Functionality
- Extension lines from points to dimension line
- Dimension line with terminators (arrows, ticks, dots)
- Centered measurement text
- Auto-snaps to endpoints

### Dimension Styles
- Linear (horizontal/vertical)
- Aligned (follows angle of measured line)
- Continuous (chain dimensions)
- Baseline (all from same origin)

### Text Options
- Above/below/centered on line
- Custom prefix/suffix
- Override text
- Tolerance notation

## Implementation Notes

### Data Structure
```typescript
interface DimensionAnnotation {
  id: string
  type: 'dimension'
  pageNum: number
  startPoint: Point
  endPoint: Point
  dimensionLineOffset: number  // Distance from measured line
  style: 'linear' | 'aligned'
  terminatorStyle: 'arrow' | 'tick' | 'dot' | 'none'
  textPosition: 'above' | 'below' | 'center'
  textOverride?: string
  color: string
}
```

### Geometry
```typescript
interface DimensionGeometry {
  extensionLine1: { start: Point; end: Point }
  extensionLine2: { start: Point; end: Point }
  dimensionLine: { start: Point; end: Point }
  textPosition: Point
  textRotation: number
}
```

### UI Components
- Extension lines (gap near object)
- Dimension line with terminators
- Text label (measurement value)
- Snap indicators

## Priority Justification
More formal than current measure tool. Industry-standard appearance for professional documentation.
