# Migration Guide: Moving to a Fresh Project

## What You Have

The `app-migration/` folder contains a **clean, self-contained PDF + SVG annotation engine** with:

✅ 41 files extracted
✅ Zero dependencies on old project mess
✅ No auth, no DB, no API routes
✅ Just pure rendering logic
✅ 59% smaller than original Konva implementation

## Step-by-Step: New Project Setup

### 1. Create Fresh Nuxt Project

```bash
npx nuxi@latest init pdf-editor
cd pdf-editor
```

### 2. Copy Migration Folder

```bash
# From your old project
cp -r /Users/bensutherland/projects/metremate/web-app/app-migration/* .
```

### 3. Install Dependencies

```bash
pnpm add pdfjs-dist@4.3.136 uuid
pnpm add -D @types/uuid
```

### 4. Update `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],

  vite: {
    build: {
      target: 'esnext' // Required for PDF.js top-level await
    }
  },

  ssr: false, // Disable SSR for easier development
})
```

### 5. Create Test Page

Copy `app-migration/example-page.vue` to `pages/index.vue`:

```bash
cp example-page.vue pages/index.vue
```

### 6. Add Test PDF

Put a PDF in `public/test.pdf` or use file upload in the example page.

### 7. Run It!

```bash
pnpm dev
```

Open `http://localhost:3000` and test!

## File Organization in New Project

```
your-new-project/
├── components/
│   ├── SimplePdfViewer.vue      # From app-migration/
│   ├── SvgAnnotationLayer.vue
│   └── tools/
│       └── *.vue
│
├── composables/
│   ├── usePDF.ts
│   └── tools/
│       └── *.ts
│
├── stores/
│   ├── annotations.ts
│   ├── renderer.ts
│   └── settings.ts
│
├── utils/
│   ├── calculations.ts
│   └── svg.ts
│
├── types/
│   ├── annotations.ts
│   └── pdf.ts
│
├── pages/
│   └── index.vue                # Your test page
│
├── public/
│   └── test.pdf                 # Your test PDF
│
└── nuxt.config.ts
```

## Testing Checklist

Once running, test each tool:

- [ ] **Upload PDF** - File loads and renders
- [ ] **Measure** - Click 2 points, see distance
- [ ] **Area** - Draw polygon, see area in m²
- [ ] **Perimeter** - Draw polygon, see total + segment lengths
- [ ] **Line** - Draw simple line
- [ ] **Fill** - Click to add fill
- [ ] **Text** - Click to add text, double-click to edit
- [ ] **Zoom** - Ctrl+scroll zooms in/out
- [ ] **Pan** - Regular scroll moves canvas
- [ ] **Delete** - Select annotation, press Delete
- [ ] **Escape** - Cancels drawing

## Adding Features Back (When Ready)

### Persistence (Choose One)

**Option A: LocalStorage (Simplest)**
```typescript
// In annotationStore
watch(annotations, (newAnnotations) => {
  localStorage.setItem('annotations', JSON.stringify(newAnnotations))
}, { deep: true })
```

**Option B: Convex (Real-time)**
```bash
pnpm add convex
npx convex dev
```

**Option C: Supabase (Full backend)**
```bash
pnpm add @supabase/supabase-js
```

### Auth (Choose One)

**Option A: Lucia Auth**
```bash
pnpm add lucia oslo
```

**Option B: Auth.js**
```bash
pnpm add @auth/nuxt
```

**Option C: Simple JWT**
Just use JWTs with your own API

### File Storage (Choose One)

**Option A: Local Filesystem**
```typescript
// Save to public/ folder
```

**Option B: Cloudflare R2**
```bash
pnpm add @aws-sdk/client-s3
```

**Option C: Supabase Storage**
```bash
# Already have client from persistence
```

## What's Already Working

1. ✅ **PDF Rendering** - Via SimplePdfViewer.vue
2. ✅ **SVG Overlay** - Via SvgAnnotationLayer.vue
3. ✅ **6 Tools** - All tool components and composables
4. ✅ **Scroll/Zoom Sync** - CSS transforms handle everything
5. ✅ **Preview** - See measurements while drawing
6. ✅ **Snap** - 45° and close-polygon snapping
7. ✅ **Keyboard** - Escape cancels, Delete removes

## Known Issues to Fix

1. ⚠️ **Drawing Events** - May need debugging (added extensive logging)
2. ⚠️ **SSR Warnings** - Solved with `ssr: false` in config
3. ⚠️ **Old Konva Files** - Still copied (area.vue, measure.vue, etc.) - can delete these

## Clean Up Old Konva Files

Once everything works, delete these from `components/tools/`:
- `area.vue`, `fill.vue`, `line.vue`, `measure.vue`, `perimeter.vue`, `text.vue`
- `interactive*.vue` files

Keep only the `*Tool.vue` files (MeasureTool.vue, AreaTool.vue, etc.)

## Support

See the original POC session notes in `docs/plan.md` for:
- Full migration history
- Architecture decisions
- Code size comparisons
- Key learnings

## Success Criteria

Your new project is ready when:

1. ✅ PDF renders on screen
2. ✅ Can click tool buttons
3. ✅ Can draw annotations
4. ✅ Scroll and zoom work
5. ✅ All 6 tools functional

**Then you can add back auth/DB/storage at your own pace!**

---

*Extracted: 2025-01-13*
*From: MetreMate Konva → SVG Migration*
*Status: Ready for fresh start 🚀*
