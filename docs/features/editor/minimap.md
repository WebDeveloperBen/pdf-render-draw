# PDF Minimap

## Overview

A minimap component that provides a bird's-eye view of the entire PDF page, showing the current viewport position and allowing quick navigation to any part of the document.

## Location

Bottom-right or bottom-left corner of the editor viewport (user configurable).

## Features

### Minimap Display

- **Thumbnail Preview**
  - Scaled-down render of current PDF page
  - Updates when page changes
  - Shows all annotations on the page
  - Respects current page rotation

- **Viewport Indicator**
  - Rectangle showing current visible area
  - Semi-transparent overlay
  - Border highlight for visibility
  - Updates in real-time as user pans/zooms

- **Zoom Level Display**
  - Current zoom percentage shown
  - Optional: zoom slider integration

### Interactions

- **Click to Navigate**
  - Click anywhere on minimap to center viewport there
  - Smooth animation to new position

- **Drag Viewport**
  - Drag the viewport indicator to pan
  - Real-time viewport updates while dragging
  - Constrained to page bounds

- **Drag to Pan (Alternative)**
  - Drag anywhere on minimap to pan viewport
  - More intuitive for some users

### Minimap Controls

- **Toggle Visibility**
  - Button to show/hide minimap
  - Keyboard shortcut: `M`
  - Preference saved per session/user

- **Resize Handle**
  - Drag corner to resize minimap
  - Minimum/maximum size constraints
  - Size preference saved

- **Position Toggle**
  - Switch between corners (BR, BL, TR, TL)
  - Avoid overlap with other UI elements

### Visual States

- **Default**
  - Semi-transparent background
  - Subtle border
  - Non-intrusive appearance

- **Hover**
  - Increased opacity
  - Cursor changes to indicate interactivity

- **Active/Dragging**
  - Full opacity
  - Visual feedback during interaction

- **Collapsed**
  - Small icon button to expand
  - Tooltip: "Show minimap"

## Configuration Options

```typescript
interface MinimapConfig {
  // Visibility
  enabled: boolean
  defaultVisible: boolean

  // Position
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  offsetX: number // pixels from edge
  offsetY: number // pixels from edge

  // Size
  width: number // default: 200
  height: number // default: auto (aspect ratio)
  minWidth: number // default: 100
  maxWidth: number // default: 400

  // Appearance
  opacity: number // default: 0.9
  borderRadius: number
  showAnnotations: boolean
  showZoomLevel: boolean

  // Behavior
  clickToNavigate: boolean
  dragToNavigate: boolean
  smoothAnimation: boolean
  animationDuration: number // ms
}
```

## UI Components

- **MinimapContainer**
  - Positioned overlay component
  - Handles drag/resize
  - Contains all minimap elements

- **MinimapCanvas**
  - Renders scaled PDF page
  - Renders annotations overlay
  - Optimized for performance

- **ViewportIndicator**
  - Draggable rectangle
  - Shows current view bounds
  - Scaled to minimap coordinates

- **MinimapControls**
  - Toggle button
  - Resize handle
  - Position selector (optional)

## Implementation Notes

### Performance Considerations

- Use lower resolution render for minimap (e.g., 0.2x scale)
- Debounce viewport indicator updates during rapid panning
- Cache minimap render, only re-render on:
  - Page change
  - Annotation add/remove/modify
  - Page rotation
- Use CSS transforms for viewport indicator movement (GPU accelerated)

### Coordinate Transformation

```typescript
// Convert minimap click to PDF coordinates
function minimapToPageCoords(minimapX: number, minimapY: number): Point {
  const scaleX = pageWidth / minimapWidth
  const scaleY = pageHeight / minimapHeight
  return {
    x: minimapX * scaleX,
    y: minimapY * scaleY
  }
}

// Convert viewport bounds to minimap coordinates
function viewportToMinimapBounds(viewport: Bounds): Bounds {
  const scaleX = minimapWidth / pageWidth
  const scaleY = minimapHeight / pageHeight
  return {
    x: viewport.x * scaleX,
    y: viewport.y * scaleY,
    width: viewport.width * scaleX,
    height: viewport.height * scaleY
  }
}
```

### Annotation Rendering

- Simplified annotation rendering (no labels, reduced detail)
- Color-coded by annotation type
- Optional: highlight selected annotations

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `M` | Toggle minimap visibility |
| `Shift+M` | Cycle minimap position |

## API/Store Integration

```typescript
// Minimap store or composable
interface MinimapState {
  isVisible: boolean
  position: MinimapPosition
  size: { width: number; height: number }

  // Actions
  toggle(): void
  setPosition(position: MinimapPosition): void
  resize(width: number, height: number): void
  navigateTo(x: number, y: number): void
}
```

## Accessibility

- Keyboard navigation support
- ARIA labels for controls
- High contrast mode support
- Screen reader announcements for navigation

## Acceptance Criteria

- [ ] Minimap displays scaled PDF page
- [ ] Viewport indicator shows current visible area
- [ ] Click on minimap navigates viewport
- [ ] Drag viewport indicator to pan
- [ ] Minimap updates with annotations
- [ ] Toggle visibility works (button + keyboard)
- [ ] Resize handle functions correctly
- [ ] Position can be changed
- [ ] Smooth animations during navigation
- [ ] Performance is acceptable (no lag during pan/zoom)
- [ ] Works with rotated pages
- [ ] Works at all zoom levels
