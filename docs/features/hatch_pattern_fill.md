# Hatch/Pattern Fill

## Priority
**Advanced** - Nice to Have

## Status
⏳ Planned

## Description
Industry-standard architectural hatching for material identification.

## Use Cases
- Identify materials on sections
- Mark concrete vs earth
- Show insulation areas
- Standard architectural notation

## Features

### Core Functionality
- Fill areas with patterns
- Industry-standard hatch patterns
- Custom pattern creation

### Standard Patterns
- **Concrete**: Triangular stipple
- **Earth/Fill**: Diagonal lines
- **Brick/Masonry**: Brick pattern
- **Insulation**: Wavy lines
- **Steel**: Solid or diagonal cross
- **Wood**: Grain pattern
- **Gravel**: Random dots
- **Water**: Wavy horizontal lines

### Customization
- Pattern scale
- Pattern rotation
- Pattern color
- Background color
- Boundary definition

## Implementation Notes

### Data Structure
```typescript
interface HatchAnnotation {
  id: string
  type: 'hatch'
  pageNum: number
  boundary: Point[]           // Area to fill
  pattern: string            // Pattern ID
  patternScale: number
  patternRotation: number
  patternColor: string
  backgroundColor?: string
}
```

### Pattern Definition
```typescript
interface HatchPattern {
  id: string
  name: string
  category: 'architectural' | 'structural' | 'mep' | 'custom'
  svg: string                // SVG pattern definition
  defaultScale: number
}
```

### SVG Pattern Approach
```xml
<defs>
  <pattern id="concrete" patternUnits="userSpaceOnUse" width="20" height="20">
    <!-- Concrete stipple pattern -->
  </pattern>
</defs>
<polygon points="..." fill="url(#concrete)" />
```

### UI Components
- Pattern picker grid
- Category tabs
- Pattern preview
- Scale/rotation controls
- Color pickers

## Implementation Complexity
**Medium** - SVG patterns are well-supported. Need library of standard patterns.

## Priority Justification
Professional feature for sections and details. Lower priority since materials are usually shown in original drawings.
