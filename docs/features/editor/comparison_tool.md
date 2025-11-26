# Comparison Tool

## Priority
**Smart Feature**

## Status
⏳ Planned

## Description
Version comparison - overlay two versions of same plan and highlight differences.

## Use Cases
- Track revisions between drawing versions
- Identify what changed between submittals
- Quality control reviews
- Client change requests

## Features

### Core Functionality
- Load two PDF versions
- Overlay with alignment
- Highlight differences
- Side-by-side view option

### Comparison Modes
- **Overlay**: Semi-transparent overlay of both versions
- **Side-by-side**: Synchronized pan/zoom on both
- **Swipe**: Reveal second version by swiping
- **Difference**: Show only changes (pixel diff)

### Alignment
- Manual alignment (pick points on both)
- Auto-alignment (if similar enough)
- Offset adjustment controls

### Difference Highlighting
- Added elements (green)
- Removed elements (red)
- Changed elements (yellow)
- Unchanged (grayscale or hidden)

## Implementation Notes

### Data Structure
```typescript
interface ComparisonSession {
  id: string
  baseDocument: string        // Document ID (older version)
  compareDocument: string     // Document ID (newer version)
  alignment: {
    basePoints: Point[]
    comparePoints: Point[]
    transform?: Matrix        // Calculated alignment transform
  }
  mode: 'overlay' | 'sideBySide' | 'swipe' | 'difference'
}
```

### Pixel Difference Algorithm
```typescript
async function computeDifference(
  baseCanvas: HTMLCanvasElement,
  compareCanvas: HTMLCanvasElement
): Promise<ImageData> {
  // Compare pixel by pixel
  // Mark differences with highlight colors
}
```

### Technical Challenges
- PDF rasterization for comparison
- Alignment accuracy
- Performance with large documents
- False positives from rendering differences

### UI Components
- Document selector (base vs compare)
- Mode selector
- Alignment point picker
- Opacity slider (for overlay)
- Swipe divider (for swipe mode)
- Difference legend

## Implementation Complexity
**High** - Requires PDF rasterization, image comparison, and careful UI design.

## Priority Justification
Very valuable for revision tracking but complex to implement well. Consider starting with side-by-side synchronized view.
