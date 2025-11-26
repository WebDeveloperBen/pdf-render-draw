# Tool Constants Refactor

Extract hardcoded values from each tool into a co-located constants object.

## Pattern

Each tool should have a `<script lang="ts">` block (non-setup) exporting:
- `TOOL_NAME_DEFAULTS` - Configuration object with all defaults
- `ToolNameConfig` - Type for the configuration

Example:
```vue
<script lang="ts">
export const FILL_TOOL_DEFAULTS = {
  color: '#3b82f6',
  opacity: 0.3,
  // ...
} as const

export type FillToolConfig = typeof FILL_TOOL_DEFAULTS
</script>
```

## Tools to Convert

- [x] **Text** - Done! Co-located in `Text.vue`
- [x] **Fill** - Done! Co-located in `Fill.vue`
- [x] **Measure** - Done! Co-located in `Measure.vue`
- [x] **Area** - Done! Co-located in `Area.vue`
- [x] **Perimeter** - Done! Co-located in `Perimeter.vue`
- [x] **Line** - Done! Co-located in `Line.vue`
- [x] **Count** - Done! Co-located in `Count.vue`

## What to Extract

For each tool, look for hardcoded values in:

1. **Tool composable** (`use*Tool.ts`)
   - Default dimensions (width, height, radius)
   - Default colors
   - Default stroke widths
   - Default opacity
   - Default font sizes

2. **Tool component** (`*.vue`)
   - SVG styling (colors, stroke widths, dash arrays)
   - Label styling (font size, background, padding)
   - UI elements (handles, markers, preview styles)

## Future Goal

These constants will eventually be:
- User-customizable via a WYSIWYG-style tool settings panel
- Stored per-user in the database
- Loaded at runtime to override defaults
