# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PDF Render Draw** is a clean, minimal Nuxt 4 application for PDF rendering and SVG-based annotation. This is a migration from a Konva-based implementation, resulting in **86% smaller store code** and **59% fewer lines overall**.

This project contains **only** the core PDF rendering engine with SVG overlay annotation tools—no auth, no database, no API routes. It's designed to be integrated into larger applications when needed.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Prepare Nuxt (generates types)
pnpm postinstall
```

## Core Architecture

### Single Coordinate System (Key Innovation)

Unlike the old Konva implementation, this uses a **unified coordinate system**:
- SVG coordinates = PDF coordinates (no normalization!)
- Both PDF canvas and SVG layer use identical CSS transforms: `translate(${scrollLeft}px, ${scrollTop}px) scale(${scale})`
- No device pixel ratio handling needed
- No dual-canvas synchronization complexity

### State Management (Pinia Stores)

Three lightweight stores in `app/stores/`:

1. **Annotation Store** (`annotations.ts`) - Flat array of all annotations
   - Single `annotations: Annotation[]` array (no nested page structure!)
   - Active tool tracking (`activeTool: 'measure' | 'area' | ...`)
   - Selection state (`selectedAnnotationId`)
   - Drawing state (`isDrawing`)
   - Total: **~140 lines** (vs 900+ lines in old Konva version)

2. **Renderer Store** (`renderer.ts`) - PDF viewport state
   - Scale/zoom level
   - Scroll position (`scrollTop`, `scrollLeft`)
   - Canvas size and current page
   - PDF document proxy from PDF.js
   - Total: **~150 lines**

3. **Settings Store** (`settings.ts`) - Tool configurations
   - Per-tool colors, stroke widths, opacities
   - Label sizes and display preferences
   - Snap distance for drawing
   - Total: **~50 lines**

### Tool Architecture (Factory Pattern)

All drawing tools use a composable factory pattern in `app/composables/tools/`:

**Base Composables:**
- `useBaseTool.ts` - Core drawing state (points, temp preview, snap logic)
- `useDrawingTool.ts` - Generic tool factory accepting configuration

**Tool-Specific Composables:**
- `useMeasureTool.ts` - 2-point distance measurements
- `useAreaTool.ts` - Polygon area in m²
- `usePerimeterTool.ts` - Polygon perimeter with individual segments
- `useLineTool.ts` - Simple line drawing
- `useFillTool.ts` - Fill/flood fill tool
- `useTextTool.ts` - Text annotations

**Tool Factory Pattern Example:**
```typescript
const tool = useDrawingTool<Measurement>({
  type: 'measure',
  minPoints: 2,
  calculate: (points) => ({
    distance: calculateDistance(points[0], points[1]),
    midpoint: calculateMidpoint(points[0], points[1])
  }),
  onCreate: (annotation) => { /* save */ }
})
```

Each tool composable returns:
- `isDrawing` - Current drawing state
- `points` - Array of placed points
- `tempEndPoint` - Preview point following cursor
- `completed` - Array of completed annotations for this tool
- `selected` - Currently selected annotation
- `handleClick()` - Mouse click handler
- `handleMove()` - Mouse move handler (for preview)
- `handleKeyDown()` - Keyboard handler (Escape, Delete)

### Component Structure

**Core Components in `app/components/`:**

- `SimplePdfViewer.vue` - PDF canvas renderer using PDF.js
  - Handles page rendering to `<canvas>`
  - Manages worker initialization
  - Syncs with renderer store for scale/position

- `SvgAnnotationLayer.vue` - SVG overlay for all annotations
  - Single `<svg>` element over PDF
  - Delegates to tool-specific components
  - Routes mouse events to active tool

**Tool Components in `app/components/tools/`:**

- `MeasureTool.vue` - Renders measurement lines with distance labels
- `AreaTool.vue` - Renders polygons with area labels
- `PerimeterTool.vue` - Renders polygons with segment measurements
- `LineTool.vue` - Renders simple lines
- `FillTool.vue` - Renders fill annotations (future implementation)
- `TextTool.vue` - Renders text annotations with editing

Each tool component:
- Uses its corresponding composable
- Renders both completed and in-progress annotations
- Handles selection and hover states
- Shows preview during drawing

### PDF Integration

**PDF Rendering** (`app/composables/usePDF.ts`):
- Wraps `pdfjs-dist` library
- Configures Web Worker for background parsing
- Returns reactive `pdf` and `totalPages` refs
- Handles loading states and errors

**Worker Configuration:**
```typescript
// Worker is configured once globally
PDFJS.GlobalWorkerOptions.workerPort = new Worker(workerSrc, { type: "module" })
```

### Type System

**Annotation Types** (`app/types/annotations.ts`):

All annotations extend `BaseAnnotation`:
```typescript
interface BaseAnnotation {
  id: string
  type: 'measure' | 'area' | 'perimeter' | 'line' | 'fill' | 'text'
  pageNum: number
}
```

Specific types:
- `Measurement` - 2 points, distance, midpoint
- `Area` - points array, area (m²), center
- `Perimeter` - points, segments array, totalLength, center
- `Line` - points array
- `Fill` - x/y position, color, opacity
- `TextAnnotation` - x/y, width/height, content, fontSize, color

Type guards available: `isMeasurement()`, `isArea()`, etc.

**PDF Types** (`app/types/pdf.ts`):
- `UsePDFSrc` - URL string or typed array
- `UsePDFOptions` - onProgress, onError callbacks

### Utilities

**Calculations** (`app/utils/calculations.ts`):
- `calculateDistance(p1, p2, scale, dpi)` - Real-world distance in mm
- `calculatePolygonArea(points, scale, dpi)` - Area in m²
- `calculateCentroid(points)` - Polygon center point
- `calculateMidpoint(p1, p2)` - Midpoint between two points
- `parsePdfPageScale(scaleString)` - Parse "1:100" format

**SVG Utilities** (`app/utils/svg.ts`):
- SVG point conversion helpers
- Polygon path generation
- Coordinate transformations

## Important Technical Details

### Coordinate Space

All coordinates are in **PDF coordinate space** (not screen space):
- Origin (0,0) is top-left of PDF page
- Units are PDF points (1/72 inch)
- No normalization between 0-1 (unlike old Konva version)
- Scale and translation applied via CSS transforms

### Drawing Flow

1. User clicks → `handleClick(e: MouseEvent)`
2. Convert screen coords to SVG coords via `getSvgPoint(e)`
3. Add point to `points` array in base tool
4. Update `tempEndPoint` on mousemove for preview
5. On completion (min points met or snap-to-close):
   - Calculate derived values (distance, area, etc.)
   - Create annotation object with UUID
   - Add to store via `addAnnotation()`
   - Reset tool state

### Snap Features

**45° Angle Snap** (hold Shift):
- Constrains drawing to 45° increments from last point
- Implemented in `snapTo45Degrees()` in `useBaseTool`

**Close Polygon Snap**:
- When cursor near first point (within `snapDistance`)
- Sets `canSnapToClose` flag
- Next click completes polygon

### Persistence (Placeholder)

The annotation store includes save/load methods but requires backend integration:

```typescript
// In annotations.ts store
async function saveAnnotations(documentUrl: string, authorId: string) {
  // Posts to /api/annotations/upsert (not included)
}

async function loadAnnotations(documentUrl: string) {
  // Fetches from /api/annotations/fetch (not included)
}
```

To add persistence:
1. **LocalStorage** - Watch `annotations` array, save to localStorage
2. **Backend API** - Implement API routes and connect to save/load
3. **Real-time** - Use Convex/Supabase realtime subscriptions

## Project Structure

```
app/
├── app.vue                      # Root component
├── components/
│   ├── SimplePdfViewer.vue      # PDF canvas renderer
│   ├── SvgAnnotationLayer.vue   # SVG overlay container
│   └── tools/                   # Tool-specific renderers
│       ├── MeasureTool.vue
│       ├── AreaTool.vue
│       ├── PerimeterTool.vue
│       ├── LineTool.vue
│       ├── FillTool.vue
│       └── TextTool.vue
├── composables/
│   ├── usePDF.ts               # PDF.js wrapper
│   └── tools/                  # Tool composables
│       ├── useBaseTool.ts      # Base drawing logic
│       ├── useDrawingTool.ts   # Tool factory
│       └── use*Tool.ts         # Specific tools
├── stores/
│   ├── annotations.ts          # Flat annotation array
│   ├── renderer.ts             # PDF viewport state
│   └── settings.ts             # Tool configurations
├── types/
│   ├── annotations.ts          # Annotation type definitions
│   └── pdf.ts                  # PDF-related types
└── utils/
    ├── calculations.ts         # Measurement calculations
    └── svg.ts                  # SVG utilities

docs/                           # Migration documentation
example-page.vue                # Example implementation
```

## Common Development Tasks

### Adding a New Tool

1. **Create type** in `app/types/annotations.ts`:
```typescript
export interface MyTool extends BaseAnnotation {
  type: 'mytool'
  // ... specific properties
}
```

2. **Create composable** in `app/composables/tools/useMyTool.ts`:
```typescript
export function useMyTool() {
  return useDrawingTool<MyTool>({
    type: 'mytool',
    minPoints: 2,
    canClose: false,
    calculate: (points) => ({ /* calculations */ }),
    onCreate: (annotation) => { /* optional logic */ }
  })
}
```

3. **Create component** in `app/components/tools/MyTool.vue`:
```vue
<script setup lang="ts">
const tool = useMyTool()
</script>

<template>
  <g @click="tool.handleClick" @mousemove="tool.handleMove">
    <!-- Render completed annotations -->
    <g v-for="item in tool.completed.value" :key="item.id">
      <!-- SVG rendering -->
    </g>

    <!-- Render drawing preview -->
    <g v-if="tool.isDrawing.value">
      <!-- Preview rendering -->
    </g>
  </g>
</template>
```

4. **Add to SvgAnnotationLayer.vue**:
```vue
<MyTool v-if="store.activeTool === 'mytool'" />
```

### Handling Scroll and Zoom

```vue
<script setup>
const rendererStore = useRendererStore()

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    e.preventDefault()
    const delta = e.deltaY * -0.01
    rendererStore.setScale(delta * 0.1)
  } else {
    // Scroll
    rendererStore.setCanvasPos({
      scrollTop: rendererStore.canvasPos.scrollTop - e.deltaY,
      scrollLeft: rendererStore.canvasPos.scrollLeft - e.deltaX
    })
  }
}
</script>
```

### Converting Screen to SVG Coordinates

```typescript
// In any tool
const point = tool.getSvgPoint(e) // MouseEvent -> SVG Point
// Returns { x, y } in PDF coordinate space
```

### Testing Tool Functionality

Load the `example-page.vue` or create a test page:

```vue
<script setup lang="ts">
const pdfUrl = ref('/test.pdf')
const { pdf } = usePDF(pdfUrl)
const annotationStore = useAnnotationStore()

onMounted(() => {
  annotationStore.setActiveTool('measure')
})
</script>

<template>
  <div class="viewer" @wheel="handleWheel">
    <SimplePdfViewer :pdf="pdf" />
    <SvgAnnotationLayer />

    <div class="toolbar">
      <button @click="annotationStore.setActiveTool('measure')">Measure</button>
      <button @click="annotationStore.setActiveTool('area')">Area</button>
      <!-- ... other tools -->
    </div>
  </div>
</template>
```

## Migration Notes

This codebase is a **clean extraction** from a larger Konva-based application. Key improvements:

### Code Size Reduction
- **Stores**: 35KB → 5KB (86% reduction)
- **Composables**: 1,700 lines → 540 lines (68% reduction)
- **Components**: 1,200 lines → 600 lines (50% reduction)
- **Overall**: ~4,200 lines → ~1,700 lines (59% reduction)

### Architectural Improvements
1. ✅ Single coordinate system (no canvas/PDF sync issues)
2. ✅ Flat annotation array (no deeply nested state)
3. ✅ Factory pattern for tools (highly reusable)
4. ✅ SVG instead of Konva (simpler, smaller bundle)
5. ✅ CSS transforms handle all positioning (no manual recalculation)

### What's NOT Included
This is a pure rendering engine. The following were intentionally excluded:
- ❌ Authentication (Supabase/Auth.js)
- ❌ Database persistence
- ❌ File upload/storage
- ❌ API routes
- ❌ User management
- ❌ Project management
- ❌ Payment/subscription logic

These can be added back when needed—the clean architecture makes integration straightforward.

### Known Limitations
1. ⚠️ **No SSR** - Set `ssr: false` in `nuxt.config.ts` (PDF.js requires browser)
2. ⚠️ **PDF.js Build Target** - Requires `target: 'esnext'` for top-level await
3. ⚠️ **Old Konva Files** - Some old component files remain (can be deleted)

Files safe to delete:
- `app/components/tools/area.vue`
- `app/components/tools/fill.vue`
- `app/components/tools/interactive*.vue`

Keep only `*Tool.vue` files (AreaTool.vue, MeasureTool.vue, etc.)

## Configuration

### Nuxt Config

Minimal configuration in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Required for PDF.js
  vite: {
    build: {
      target: 'esnext'
    }
  },

  // Recommended during development
  ssr: false
})
```

### Dependencies

Core dependencies:
- `nuxt` ^4.2.1 - Nuxt 4 framework
- `vue` ^3.5.24 - Vue 3
- `vue-router` ^4.6.3 - Routing
- `pdfjs-dist` ^4.3.136 - PDF rendering (add manually)
- `uuid` - Annotation ID generation (add manually)

Install PDF dependencies:
```bash
pnpm add pdfjs-dist@4.3.136 uuid
pnpm add -D @types/uuid
```

## Debugging

### Common Issues

**Problem: PDF doesn't render**
- Check browser console for worker initialization errors
- Verify PDF URL is accessible
- Ensure `target: 'esnext'` in Vite config

**Problem: Mouse events don't work**
- Check that tool is active: `annotationStore.activeTool`
- Verify SVG layer has `pointer-events: all`
- Check console for event handler logs (extensive logging included)

**Problem: Coordinates are wrong**
- Verify both PDF and SVG have same transform CSS
- Check `rendererStore.scale` and `canvasPos` values
- Use `getSvgPoint()` to convert screen to SVG coords

**Problem: Annotations disappear on zoom**
- Ensure SVG viewBox matches PDF dimensions
- Check that annotation coordinates are in PDF space (not screen space)

### Debug Logging

All tool composables include extensive logging:
```typescript
console.log(`[${config.type}Tool] handleClick called`, {
  isDrawing: annotationStore.isDrawing,
  currentPoints: base.points.value.length
})
```

Enable in browser console to trace drawing flow.

## Testing Strategy

Since this is a UI-heavy annotation tool, focus on:

1. **Manual Testing** - Load test PDF and verify each tool
2. **Visual Regression** - Screenshot comparisons for rendering
3. **Unit Tests** - For calculation utilities:
   - `calculateDistance()`
   - `calculatePolygonArea()`
   - `calculateCentroid()`

4. **Integration Tests** - For store operations:
   - Add/update/delete annotations
   - Tool switching
   - Selection state

## Performance Considerations

- **PDF.js Worker**: Offloads PDF parsing to separate thread
- **Shallow Refs**: Renderer store uses `shallowRef()` for large objects
- **CSS Transforms**: Hardware-accelerated positioning
- **SVG Rendering**: Native browser rendering, no canvas redraw overhead
- **Minimal Re-renders**: Computed properties prevent unnecessary updates

## Future Enhancements

Potential additions (not currently implemented):
- Multi-page annotation support (currently single page focused)
- Annotation history/undo
- Export annotations to JSON
- Import annotations from JSON
- Collaborative editing (real-time)
- Annotation comments/threads
- Layer management
- Annotation grouping
- Copy/paste annotations

---

*Last Updated: 2025-01-13*
*Migration from: MetreMate Konva → SVG*
*Project Status: Clean extraction, ready for integration*
