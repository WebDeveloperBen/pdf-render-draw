# Callout/Arrow Tool

## Priority
**High** - Essential for Construction/Architecture

## Status
⏳ Planned

## Description
Point to specific features with arrows and leader lines with text labels.

## Use Cases
- Highlight specific features
- Add notes pointing to elements
- Mark issues or concerns
- Contractor markups

## Features

### Core Functionality
- Leader line from point to text box
- Arrowhead pointing to feature
- Text label with note content

### Visual Customization
- Color-coded by priority:
  - Red = critical/urgent
  - Yellow = note/attention
  - Green = approved/OK
  - Blue = question/info
- Customizable arrow styles
- Multiple arrowhead types

### Layout Options
- Elbow/bent leader lines
- Straight leader lines
- Auto-positioning text box
- Drag to reposition

## Implementation Notes

### Data Structure
```typescript
interface CalloutAnnotation {
  id: string
  type: 'callout'
  pageNum: number
  targetPoint: Point      // Where arrow points
  textPosition: Point     // Where text box is placed
  bendPoint?: Point       // Optional elbow point
  content: string
  priority: 'critical' | 'note' | 'approved' | 'question'
  color: string
  arrowStyle: 'filled' | 'open' | 'circle'
}
```

### UI Components
- Arrow/leader line
- Text box (editable)
- Priority color indicator
- Drag handles for repositioning

## Priority Justification
Fills annotation gap between simple text and highlighting. Industry-standard markup style.
