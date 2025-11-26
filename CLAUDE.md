# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF annotation editor built with Nuxt 4 and PDF.js. Renders PDFs on canvas with an SVG overlay for interactive annotations. Uses transformation matrices for coordinate transformations and SVG transforms for visual effects.

**Key constraint:** SSR disabled - PDF.js requires browser APIs.

## Commands

```bash
# Development
pnpm dev                    # Start dev server (http://localhost:3000)
pnpm build                  # Production build
pnpm check                  # TypeScript type checking

# Testing
pnpm test                   # Run Vitest unit tests
pnpm test path/to/file      # Run specific test file
pnpm test:coverage          # Run tests with coverage report
pnpm exec playwright test   # Run E2E tests
pnpm exec playwright test --ui  # E2E with interactive UI

# Code Quality
pnpm lint                   # ESLint with auto-fix
```

## Architecture

### Coordinate Systems

The editor uses PDF coordinates as the single source of truth:
- All annotation data stored in PDF coordinate space (no normalization)
- CSS transforms (`translate`, `scale`, `rotate`) sync the SVG layer with the PDF canvas
- `rendererStore.getCanvasTransform` provides the unified transform string

### Core Stores (Pinia)

- **`annotations.ts`**: Flat array of annotations, selection state, CRUD operations with validation
- **`renderer.ts`**: PDF viewport state (scale, rotation, scroll position, pdfScale), PDF.js document loading
- **`history.ts`**: Undo/redo command stack

### Annotation Types

All annotations extend `BaseAnnotation` with `id`, `type`, `pageNum`, `rotation`:
- **Point-based:** `Measurement` (2 points), `Area` (3+ points), `Perimeter` (3+ points), `Line` (2+ points)
- **Positioned rectangles:** `Fill`, `TextAnnotation`, `Count` (have `x`, `y`, `width`, `height`)

Type guards in `app/types/annotations.ts`: `isMeasurement()`, `isArea()`, `isFill()`, etc.

### Composables Structure

```
app/composables/
├── editor/
│   ├── tools/          # Tool-specific: useAreaTool, useMeasureTool, etc.
│   ├── useEditorBounds.ts      # Bounding box calculations
│   ├── useEditorCoordinates.ts # SVG coordinate conversion
│   ├── useEditorEventHandlers.ts # Global mouse/keyboard events
│   ├── useEditorRotation.ts    # Rotation transforms
│   ├── useEditorScale.ts       # Scale transforms
│   ├── useEditorMove.ts        # Drag/move operations
│   └── useEditorSelection.ts   # Selection logic
└── useKeyboardShortcuts.ts     # Global keyboard shortcuts
```

### Tool Factory Pattern

Tools use `useDrawingTool` factory with callbacks:
```typescript
const tool = useDrawingTool<Measurement>({
  type: 'measure',
  minPoints: 2,
  calculate: (points) => ({ distance, midpoint }),
  onCreate: (annotation) => { /* save */ }
})
```

### Tool Styling

Each tool component exports a `*_TOOL_DEFAULTS` constant with all styling (colors, stroke widths, etc.):
```typescript
// In Measure.vue
export const MEASURE_TOOL_DEFAULTS = {
  strokeColor: 'black',
  strokeWidth: 1,
  labelColor: 'black',
  // ...
}
```

### Transform Handles

Annotations display transform handles when selected:
- Scale handles at corners/edges
- Rotation handle offset from center
- Multi-select uses group transforms around combined center

### PDF Worker Initialization

PDF.js worker loads lazily on first `loadPdf()` call - not at app startup. This keeps non-editor pages fast.

## Testing Patterns

Unit tests colocated with source files as `*.spec.ts`. Test environment is `nuxt` with `happy-dom`.

Coverage targets: `app/composables/**`, `app/stores/**`, `app/utils/**`

E2E tests in `app/tests/e2e/` using Playwright against `http://localhost:3000`.

## Key Implementation Details

- Rotation stored in radians on annotations, displayed in degrees in UI
- Labels have `labelRotation` (degrees) baked at creation time to appear upright regardless of PDF rotation
- `recalculateDerivedValues()` updates `distance`, `midpoint`, `area`, `center` when points change
- Validation via `validateAnnotation()` shape-based checker (tool-agnostic)
