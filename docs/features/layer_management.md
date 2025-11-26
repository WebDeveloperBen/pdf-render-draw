# Layer Management

## Priority
**Smart Feature**

## Status
⏳ Planned

## Description
Organize annotations by trade with separate layers, toggleable visibility, and color coding.

## Use Cases
- Separate annotations by trade (electrical, plumbing, structural)
- Toggle visibility per layer
- Bulk edit annotations by layer
- Professional organization

## Features

### Core Functionality
- Create named layers
- Assign annotations to layers
- Toggle layer visibility
- Color code by layer

### Layer Properties
- Name (e.g., "Electrical", "Plumbing", "Structural")
- Color (applied to all annotations on layer)
- Visibility (show/hide)
- Lock (prevent editing)
- Opacity (layer-wide transparency)

### Default Layers
- Measurements
- Areas
- Counts
- Text/Notes
- Custom (user-created)

### Operations
- Move annotations between layers
- Merge layers
- Delete layer (with annotations or reassign)
- Duplicate layer

## Implementation Notes

### Data Structure
```typescript
interface Layer {
  id: string
  name: string
  color: string
  visible: boolean
  locked: boolean
  opacity: number
  order: number              // Z-order
}

// Annotation gets layer reference
interface Annotation {
  // ... existing fields
  layerId?: string
}
```

### Layer Store
```typescript
interface LayerState {
  layers: Layer[]
  activeLayerId: string      // New annotations go here
}
```

### Rendering
- Filter annotations by visible layers
- Apply layer color override (optional)
- Apply layer opacity
- Respect layer z-order

### UI Components
- Layer panel (like Photoshop/CAD)
- Visibility toggles (eye icons)
- Lock toggles
- Color swatches
- Drag to reorder
- Right-click context menu

## Implementation Complexity
**Medium** - Data structure is simple. UI needs polish for professional feel.

## Priority Justification
Essential for complex documents with multiple trades. Industry standard in CAD software.
