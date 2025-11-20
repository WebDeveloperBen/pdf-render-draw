# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MetreMate is a Nuxt 3 application for PDF annotation and measurement. The application provides a canvas-based editor using Konva.js where users can annotate PDFs with various measurement tools (measure, area, perimeter, line), fill tools, and text annotations.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server (http://localhost:3000)
pnpm run dev

# Run tests
pnpm test

# Build for production
pnpm run build

# Preview production build
pnpm run preview

# Regenerate Supabase types from database schema
pnpm run db:types
```

## Core Architecture

### State Management (Pinia Stores)

The application uses three primary Pinia stores located in `stores/`:

1. **Main Store** (`stores/main.ts`) - Central state for all annotation tools across pages
   - Manages a centralized state structure with per-page tool states
   - Each page contains: `measureTool`, `areaTool`, `perimeterTool`, `lineTool`, `fillTool`, `textTool`
   - Handles CRUD operations for annotations via API calls
   - Tools use a pattern of: `isDrawing`, `startPosition`, `tempLine`, `selected[Tool]` states

2. **Renderer Store** (`stores/renderer.ts`) - PDF rendering and canvas management
   - Manages Konva stage, transformer, and PDF document proxy
   - Handles zoom/scale, canvas position, and page navigation
   - Tracks PDF loading state and initialization

3. **Settings Store** (`stores/settings.ts`) - User preferences and tool configurations
   - Canvas settings (zoom increments, scale limits, snap distance)
   - Per-tool styling (colors, stroke widths, opacity, label sizes)
   - Measurement units and display preferences

### Tool Architecture

Each annotation tool follows a composable pattern in `composables/`:

- `useMeasure.ts` - Linear measurements with distance calculation
- `useArea.ts` - Area measurements with polygon drawing
- `usePerimeter.ts` - Perimeter measurements
- `useLine.ts` - Simple line drawing
- `useFill.ts` - Fill/flood fill tool
- `useText.ts` - Text annotation tool
- `useSelection.ts` - Object selection and manipulation

Tool composables return:
- `state` - Tool-specific reactive state
- `setActive()` - Activation handler
- `handleToolSwap()` - Cleanup when switching tools

### PDF and Canvas Integration

- **PDF Rendering**: Uses `pdfjs-dist` for PDF parsing (see `composables/usePDF.ts`)
- **Canvas**: Konva.js-based canvas for drawing annotations (components in `components/viewer/canvas/`)
- **Coordinate System**: Canvas position and PDF position are inverted and managed through scale transformations

### API Structure

Server API routes in `server/api/`:

- **Projects**: CRUD operations for projects (`projects/`)
- **Documents**: CRUD operations for documents within projects (`documents/`)
- **Annotations**: CRUD operations for annotations on documents (`annotations/`)
- **Payments**: Stripe integration for subscriptions (`payments/`)
- **Webhooks**: Stripe and Supabase webhook handlers (`webhooks/`)
- **User**: User profile management (`user/`)
- **Email**: SendGrid email functionality (`email/`)

### Authentication & Authorization

- Uses `@nuxtjs/supabase` for authentication
- Global auth middleware at `middleware/1.auth.global.ts`
- Public routes defined in middleware: `/login`, `/register`, `/wizard`, `/forgot-password`, `/reset-password`, `/confirm`
- Supabase auto-redirects to `/login` for unauthorized access
- Session duration: 8 hours

### Database

- **Provider**: Supabase (PostgreSQL)
- **Type Safety**: TypeScript types generated in `db/supabase/database.types.ts`
- **Schema**: Public schema with tables for users, projects, documents, annotations
- Regenerate types after schema changes with `pnpm run db:types`

### Key Page Routes

- `/` - Landing page
- `/editor/[projectId]` - Main PDF editor interface
- `/project/[id]` - Project detail view
- `/wizard`, `/wizard/step-2`, `/wizard/step-3` - Onboarding wizard
- `/pricing` - Subscription pricing page
- `/profile` - User profile management

### Component Organization

- `components/viewer/` - PDF viewer and annotation canvas components
  - `canvas/` - Konva canvas and layer components
  - `tools/` - Tool-specific UI components
  - `modal/` - Modal dialogs for viewer
- `components/forms/` - Reusable form components
- `components/wizard/` - Wizard-specific components
- `components/table/` - Data table components
- `components/ui/` - General UI components

### Testing

- **Framework**: Vitest with Nuxt test utils
- **Environment**: Nuxt environment for component testing
- **Test files**: Located in `tests/` directory
- Run specific test: `pnpm test <test-file-name>`

## Important Technical Details

### Konva Canvas State

- The main store's `state.pages` array is indexed by `currentPageIdx` (0-based)
- PDF pages are 1-indexed in rendering but 0-indexed in state
- Konva transformer handles object selection and manipulation
- All drawing coordinates are in PDF coordinate space, transformed by scale

### Annotation Persistence

- Annotations are stored per-document in Supabase
- Each annotation has: `id`, `type`, `page_number`, `data` (JSON)
- Annotations are loaded when a document is opened
- Changes are persisted via API calls in the main store

### Multi-Step Forms

- `composables/multi-step-form.ts` provides wizard functionality
- Used in onboarding wizard (`/wizard` routes)
- Handles step navigation and state persistence

### Environment Variables

Required variables (see `.env.example`):
- Supabase: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`
- Stripe: `NUXT_STRIPE_PUBLIC_KEY`, `NUXT_STRIPE_SECRET_KEY`, `NUXT_STRIPE_WEBHOOK_SECRET`
- SendGrid: `NUXT_SENDGRID_API_KEY`
- Domain: `NUXT_PUBLIC_DOMAIN_URL`
- Sentry: `NUXT_PUBLIC_SENTRY_DSN`, `NUXT_PUBLIC_SENTRY_ENVIRONMENT`

### Build Configuration

- **Target**: ESNEXT (required for pdfjs-dist top-level await)
- **UI Framework**: @shuriken-ui/nuxt for base components
- **Toast Notifications**: vue-toastification
- **PDF Manipulation**: pdf-lib for PDF generation/modification
- **Error Tracking**: Sentry integration with source maps

## Common Patterns

### Adding a New Tool

1. Create composable in `composables/use[ToolName].ts` following the `ToolComposable<T>` interface
2. Add tool state to `CentralAnnotationState` type in `types/tools.ts`
3. Add tool to `Tools` union type: `"measure" | "area" | ... | "yourTool"`
4. Initialize tool state in main store's `initialState.pages[0]`
5. Create menu component in `components/viewer/menuTool[ToolName].vue`
6. Create tool UI component in `components/viewer/tools/[toolName].vue`
7. Add tool handlers to main store's tool swap logic

### Making API Calls

Use `$fetch` for API calls:
```typescript
await $fetch('/api/projects/new', {
  method: 'POST',
  body: JSON.stringify({ name, description })
})
```

### Accessing Stores in Components

```typescript
const mainStore = useMainStore()
const rendererStore = useRendererStore()
const settings = useSettingStore()
```

### Type Safety with Supabase

Import database types:
```typescript
import type { Database } from '~/db/supabase/database.types'
type Project = Database['public']['Tables']['projects']['Row']
```
