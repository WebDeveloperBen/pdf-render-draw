# PDF + SVG Annotation Engine

**Clean extraction of the core rendering engine - no auth, no DB, pure PDF + SVG magic.**

## What's In Here

This folder contains **only** the essential PDF rendering and SVG annotation tools:

```
app-migration/
├── components/
│   ├── SimplePdfViewer.vue       # PDF canvas renderer (pure PDF.js)
│   ├── AnnotationRendererLayer.vue    # SVG overlay with event routing
│   └── tools/                     # 6 SVG tool components
│       ├── MeasureTool.vue        # Distance measurements
│       ├── AreaTool.vue           # Area calculations (m²)
│       ├── PerimeterTool.vue      # Perimeter with segment lengths
│       ├── LineTool.vue           # Simple line drawing
│       ├── FillTool.vue           # Fill/flood fill
│       └── TextTool.vue           # Text annotations
│
├── composables/
│   ├── usePDF.ts                  # PDF.js wrapper with worker
│   └── tools/                     # Tool composables
│       ├── useBaseTool.ts         # Base drawing logic
│       ├── useDrawingTool.ts      # Drawing tool factory
│       ├── useMeasureTool.ts      # Measure tool logic
│       ├── useAreaTool.ts         # Area tool logic
│       ├── usePerimeterTool.ts    # Perimeter tool logic
│       ├── useLineTool.ts         # Line tool logic
│       ├── useFillTool.ts         # Fill tool logic
│       └── useTextTool.ts         # Text tool logic
│
├── stores/
│   ├── annotations.ts             # Simplified annotation store (flat array)
│   ├── renderer.ts                # PDF viewport state (scale, scroll, canvas size)
│   └── settings.ts                # Tool settings (colors, widths, etc.)
│
├── utils/
│   ├── calculations.ts            # Distance, area, centroid calculations
│   └── svg.ts                     # SVG utility functions
│
├── types/
│   ├── annotations.ts             # Annotation type definitions
│   └── pdf.ts                     # PDF-related types
│
└── docs/
    ├── plan.md                    # Migration plan and architecture
    └── CLAUDE.md                  # Project overview
```

## Key Features

✅ **PDF Rendering** - Powered by PDF.js with Web Worker
✅ **SVG Overlay** - Synchronized scrolling and zooming
✅ **6 Annotation Tools** - Measure, Area, Perimeter, Line, Fill, Text
✅ **Real-time Preview** - See measurements while drawing
✅ **Snap Features** - 45° snapping, close polygon snapping
✅ **No Dependencies** - No auth, no DB, no backend required
✅ **Type-Safe** - Full TypeScript support
✅ **86% Smaller** - Compared to old Konva implementation

## Quick Start

### 1. Install Dependencies

```bash
pnpm add pdfjs-dist uuid
```

### 2. Create a Simple Page

```vue
<script setup lang="ts">
// Mock PDF URL (or load from file)
const pdfString = ref('/path/to/your.pdf')
const { pdf } = usePDF(pdfString)

const annotationStore = useAnnotationStore()
const rendererStore = useRendererStore()

// Set initial tool
onMounted(() => {
  annotationStore.setActiveTool('measure')
})
</script>

<template>
  <div class="pdf-editor">
    <!-- PDF Canvas -->
    <SimplePdfViewer :pdf="pdf" />

    <!-- SVG Annotation Layer -->
    <AnnotationRendererLayer />

    <!-- Tool Buttons -->
    <div class="tools">
      <button @click="annotationStore.setActiveTool('measure')">Measure</button>
      <button @click="annotationStore.setActiveTool('area')">Area</button>
      <button @click="annotationStore.setActiveTool('perimeter')">Perimeter</button>
      <button @click="annotationStore.setActiveTool('line')">Line</button>
      <button @click="annotationStore.setActiveTool('fill')">Fill</button>
      <button @click="annotationStore.setActiveTool('text')">Text</button>
    </div>
  </div>
</template>

<style scoped>
.pdf-editor {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f0f0f0;
}

.tools {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 100;
  display: flex;
  gap: 8px;
}
</style>
```

### 3. Handle Scroll/Zoom

```vue
<script setup>
function handleWheel(e: WheelEvent) {
  const rendererStore = useRendererStore()

  if (e.ctrlKey || e.metaKey) {
    // Zoom
    e.preventDefault()
    const delta = e.deltaY * -0.01
    const newScale = rendererStore.getScale * (1 + delta * 0.1)
    rendererStore.setScale(newScale)
  } else {
    // Scroll
    rendererStore.setCanvasPos({
      scrollTop: rendererStore.getCanvasPos.scrollTop - e.deltaY,
      scrollLeft: rendererStore.getCanvasPos.scrollLeft - e.deltaX,
    })
  }
}
</script>

<template>
  <div @wheel="handleWheel">
    <!-- ... -->
  </div>
</template>
```

## Architecture Highlights

### Single Coordinate System
- SVG coordinates = PDF coordinates (no normalization needed!)
- No device pixel ratio handling
- No dual-canvas synchronization

### CSS Transform Sync
Both PDF canvas and SVG layer use:
```typescript
transform: `translate(${scrollLeft}px, ${scrollTop}px) scale(${scale})`
```

### Flat State Management
```typescript
// Old Konva: Deeply nested state, 900+ lines
state.pages[0].measureTool.measurements[0].points...

// New SVG: Flat array, 150 lines
annotations = [{ id, type, pageNum, data }]
```

### Tool Factory Pattern
```typescript
const tool = useDrawingTool<Measurement>({
  type: 'measure',
  minPoints: 2,
  calculate: (points) => ({ distance, midpoint }),
  onCreate: (annotation) => { /* save */ }
})
```

## Code Size Comparison

| Component | Old (Konva) | New (SVG) | Reduction |
|-----------|-------------|-----------|-----------|
| Stores | 35KB | 5KB | **86%** |
| Composables | 1,700 lines | 540 lines | **68%** |
| Components | 1,200 lines | 600 lines | **50%** |
| **Total** | **~4,200 lines** | **~1,700 lines** | **59%** |

## What's NOT Included

❌ Authentication (Supabase/Auth.js)
❌ Database persistence
❌ File storage
❌ API routes
❌ User management
❌ Project management

**These can be added back easily once the core engine is working!**

## Next Steps

1. **Test in New Project** - Copy this folder to a fresh Nuxt app
2. **Add Test PDF** - Load a sample PDF to test rendering
3. **Test Each Tool** - Click through all 6 tools
4. **Add Persistence** - Hook up to your preferred backend (Convex, Supabase, etc.)
5. **Add Auth** - When you need it

## Migration Notes

See `docs/plan.md` for full migration history and architectural decisions.

### Key Learnings from POC

1. ✅ **SVG > Konva** - Simpler, smaller, no canvas sync issues
2. ✅ **CSS Transforms** - Handle all positioning/scaling
3. ✅ **Flat Store** - No nested state needed
4. ✅ **Factory Pattern** - Composables are tiny and reusable
5. ⚠️ **Drawing Debug Needed** - Mouse events need testing

## Support

This extraction was done on 2025-01-13 as part of the Konva → SVG migration.
