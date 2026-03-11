# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**PDF Annotator** - A PDF annotation editor for tradespeople to draw and measure building plans. Built with Nuxt 4, PDF.js, and a comprehensive UI component system.

**Key constraint:** SSR disabled for editor - PDF.js requires browser APIs.

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

# Code Quality
pnpm lint                   # ESLint with auto-fix
```

## Tech Stack

### Core
- **Nuxt 4** with TypeScript strict mode
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Pinia** for state management
- **VueUse** for composables

### UI Components
- **UI-Thing** (shadcn-vue style) components in `app/components/ui/`
- **Reka UI** as the headless component primitive layer
- **tailwind-variants** (`tv()`) for component styling with variants
- **motion-v** for animations

### Icons
- **@nuxt/icon** with Iconify - use `<Icon name="lucide:icon-name" />` format
- Do NOT use lucide-vue-next directly

### Forms & Validation
- **vee-validate** with `@vee-validate/nuxt`
- **zod** for schema validation via `@vee-validate/zod`

### PDF
- **pdfjs-dist** for PDF rendering (lazy-loaded)
- Worker loads on first `loadPdf()` call

## Project Structure

### Pages (Route Groups)
```
app/pages/
├── (auth)/           # /login, /register - no sidebar
├── (dashboard)/      # Main app with sidebar layout
│   ├── index.vue           → /
│   ├── projects/
│   │   ├── index.vue       → /projects
│   │   └── [id].vue        → /projects/:id
│   ├── users/
│   │   ├── index.vue       → /users
│   │   └── roles.vue       → /users/roles
│   ├── support.vue         → /support
│   └── settings.vue        → /settings
├── (editor)/         # Full-screen editor - custom layout
└── (payment)/        # Payment flows
```

Route groups `(folder)` don't appear in URLs.

### Layouts
- `default.vue` - Dashboard layout with sidebar (uses `UiSidebar*` components)
- Editor pages should use a custom layout or `definePageMeta({ layout: false })`

### UI Components
```
app/components/ui/
├── Sidebar/          # App navigation sidebar
├── Button.vue        # Exports buttonStyles for variant reuse
├── Form/             # Form components with vee-validate integration
├── Vee/              # Vee-validate wrapped form inputs
└── ...               # ~80+ shadcn-style components
```

Component imports use `Ui` prefix auto-imported: `<UiButton>`, `<UiCard>`, etc.

### Composables
```
app/composables/
├── editor/
│   ├── tools/                  # Tool-specific composables
│   ├── useEditorBounds.ts
│   ├── useEditorCoordinates.ts
│   └── ...
├── useCarousel.ts              # UI-Thing carousel state
├── useFormField.ts             # Form field context
└── useKeyboardShortcuts.ts
```

## Styling Patterns

### tailwind-variants (tv)
Components use `tv()` for variant-based styling:
```typescript
const buttonStyles = tv({
  base: "inline-flex items-center justify-center rounded-md",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      outline: "border border-input bg-background",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 px-3",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})
```

### CSS Variables (Tailwind v4)
Theme colors defined in `app/assets/css/tailwind.css`:
```css
--color-primary: ...;
--color-background: ...;
--color-foreground: ...;
```

Use semantic color classes: `bg-primary`, `text-muted-foreground`, `border-input`

## Editor Architecture

### Coordinate Systems
- All annotation data stored in PDF coordinate space
- CSS transforms sync SVG layer with PDF canvas
- `viewportStore.getCanvasTransform` provides unified transform

### Core Stores (Pinia)
- **`annotations.ts`**: Annotations array, selection, CRUD with validation
- **`viewport.ts`**: PDF viewport state, scale, rotation, document loading
- **`history.ts`**: Undo/redo command stack

### Annotation Types
All extend `BaseAnnotation` with `id`, `type`, `pageNum`, `rotation`:
- **Point-based:** `Measurement`, `Area`, `Perimeter`, `Line`
- **Rectangles:** `Fill`, `TextAnnotation`, `Count`

Type guards in `app/types/annotations.ts`: `isMeasurement()`, `isArea()`, etc.

### Tool Factory Pattern
```typescript
const tool = useDrawingTool<Measurement>({
  type: 'measure',
  minPoints: 2,
  calculate: (points) => ({ distance, midpoint }),
  onCreate: (annotation) => { /* save */ }
})
```

## Testing

- Unit tests colocated as `*.spec.ts`
- Test environment: `nuxt` with `happy-dom`
- Coverage targets: `app/composables/**`, `app/stores/**`, `app/utils/**`
- E2E: Playwright in `app/tests/e2e/`

## Key Conventions

1. **Icons**: Always `<Icon name="lucide:icon-name" />`, never direct lucide imports
2. **Components**: Use `Ui` prefix from auto-imports
3. **Styling**: Prefer `tv()` variants over inline conditional classes
4. **Forms**: Use `UiVee*` components for validated inputs
5. **Routes**: Use typed routes with `useRoute("route-name")` for params
6. **Toasts**: Use `useSonner()` (auto-imported from vue-sonner)
