# Symbol/Stamp Tool

## Priority
**Medium** - Very Useful

## Status
⏳ Planned

## Description
Pre-made symbols and stamps for common annotations like "APPROVED", "REJECTED", north arrows, etc.

## Use Cases
- Document approval stamps
- Status indicators
- North arrows
- Material symbols
- Custom stamp library

## Features

### Core Functionality
- Click to place stamps
- Resize and rotate
- Date/user auto-fill options

### Built-in Stamps
**Status Stamps:**
- APPROVED (green checkmark)
- REJECTED (red X)
- REVIEWED (blue eye)
- REVISED (orange refresh)
- SEE NOTE (yellow asterisk)
- FOR REVIEW (purple question)

**Drawing Symbols:**
- North arrow (multiple styles)
- Scale bar
- Section marker
- Detail marker
- Grid bubble

**Material Symbols:**
- Concrete
- Steel
- Wood
- Masonry
- Insulation
- Earth/fill

### Custom Stamps
- Upload custom images
- Save frequently used
- Share within organization

## Implementation Notes

### Data Structure
```typescript
interface StampAnnotation {
  id: string
  type: 'stamp'
  pageNum: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  stampType: string           // Built-in stamp ID
  customImage?: string        // Base64 or URL for custom stamps
  text?: string              // For text stamps
  date?: string              // Auto-filled date
  user?: string              // Auto-filled username
}
```

### Built-in Stamp Registry
```typescript
interface StampDefinition {
  id: string
  name: string
  category: 'status' | 'drawing' | 'material'
  svg: string                 // SVG content
  defaultWidth: number
  defaultHeight: number
  color?: string
}
```

### UI Components
- Stamp picker panel
- Category tabs
- Search/filter
- Recent stamps
- Custom stamp uploader
- Stamp properties panel

## Priority Justification
Speeds up common annotation tasks. Industry-standard for document management and construction drawing notation.
