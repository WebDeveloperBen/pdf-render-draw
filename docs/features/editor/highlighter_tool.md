# Highlighter Tool

## Priority
**Medium** - Very Useful

## Status
⏳ Planned

## Description
Semi-transparent rectangle or freeform area for highlighting important sections.

## Use Cases
- Highlight important sections
- Mark areas for review
- Color-code by trade/priority
- Draw attention to specific elements

## Features

### Core Functionality
- Semi-transparent fill
- Rectangle or freeform shapes
- Multiple colors for different purposes

### Drawing Modes
- Rectangle (click-drag)
- Freeform (draw path, auto-close)
- Ellipse option

### Color Coding
- Predefined color palette
- Custom colors
- Opacity control
- Color legend/key

## Implementation Notes

### Data Structure
```typescript
interface HighlightAnnotation {
  id: string
  type: 'highlight'
  pageNum: number
  shape: 'rectangle' | 'freeform' | 'ellipse'
  // For rectangle/ellipse:
  x?: number
  y?: number
  width?: number
  height?: number
  // For freeform:
  points?: Point[]
  color: string
  opacity: number   // 0.1 - 0.5 typically
}
```

### Predefined Colors
```typescript
const HIGHLIGHT_PRESETS = {
  yellow: { color: '#FFEB3B', label: 'Important' },
  green: { color: '#4CAF50', label: 'Approved' },
  red: { color: '#F44336', label: 'Attention' },
  blue: { color: '#2196F3', label: 'Info' },
  orange: { color: '#FF9800', label: 'Review' },
  purple: { color: '#9C27B0', label: 'Question' }
}
```

### UI Components
- Shape selector (rectangle/freeform)
- Color palette
- Opacity slider
- Active highlight preview

## Priority Justification
Simple but highly useful for drawing attention to areas. Different from fill tool by being semi-transparent and categorizable.
