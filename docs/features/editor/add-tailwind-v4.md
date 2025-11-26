# Feature: Add Tailwind CSS v4

## Overview

Add Tailwind CSS v4 to the project for styling UI components (sidebar, pages, dialogs, buttons, etc.) while keeping scoped CSS for SVG-based annotation and tool rendering.

## Motivation

- Faster UI development with utility classes
- Consistent design tokens (colors, spacing, typography)
- Better maintainability for non-SVG components
- Tailwind v4 has improved performance and simpler configuration

## Scope

### In Scope (use Tailwind)
- `app/pages/*.vue` - Page layouts
- `app/components/Editor/Sidebar.vue` - Navigation sidebar
- `app/app.vue` - Root layout
- Future UI components (modals, dropdowns, toolbars, settings panels)
- Any non-SVG UI elements

### Out of Scope (keep scoped CSS)
- `app/components/Editor/Tools/*.vue` - SVG tool rendering
- `app/components/Editor/Handles/*.vue` - SVG transform handles
- `app/components/Editor/Annotation.vue` - SVG annotation wrapper
- `app/components/Editor/AnnotationLayer.vue` - SVG layer
- `app/components/Editor/PdfViewer.vue` - Canvas/PDF rendering

**Why exclude these?**
1. SVG elements use properties Tailwind doesn't support (`stroke-linecap`, `pointer-events: stroke`, `fill-opacity`)
2. Tool styles use `v-bind()` for dynamic values from config objects
3. Keyframe animations for visual feedback (snap indicators, etc.)

## Installation

### 1. Install dependencies

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

### 2. Configure Vite plugin

```ts
// nuxt.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  vite: {
    plugins: [
      tailwindcss()
    ]
  }
})
```

### 3. Create CSS entry point

```css
/* app/assets/css/main.css */
@import "tailwindcss";

/* Custom theme overrides (optional) */
@theme {
  --color-primary: #0066cc;
  --color-surface: #2c2c2c;
  --color-surface-elevated: #383838;
  --color-border: #444;
}
```

### 4. Import in Nuxt config

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['~/assets/css/main.css']
})
```

## Migration Strategy

### Phase 1: Setup (this feature)
- Install Tailwind v4
- Configure with Nuxt/Vite
- Verify build works alongside existing scoped styles

### Phase 2: Migrate UI components
- Convert `Sidebar.vue` styles to Tailwind classes
- Convert page layouts (`index.vue`, `editor.vue`)
- Convert `app.vue` root styles

### Phase 3: Design system
- Define color palette in `@theme`
- Create consistent spacing/typography tokens
- Document component patterns

## Example Conversion

### Before (scoped CSS)
```vue
<template>
  <button class="close-btn">×</button>
</template>

<style scoped>
.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}
.close-btn:hover {
  color: #fff;
}
</style>
```

### After (Tailwind)
```vue
<template>
  <button class="bg-transparent border-none text-gray-400 text-3xl cursor-pointer p-0 w-6 h-6 flex items-center justify-center transition-colors hover:text-white">
    ×
  </button>
</template>
```

## Verification

- [ ] `pnpm dev` starts without errors
- [ ] Existing SVG tool rendering unchanged
- [ ] Tailwind classes apply correctly
- [ ] No style conflicts between Tailwind reset and SVG styles
- [ ] Production build works (`pnpm build`)

## Notes

- Tailwind v4 uses CSS-based configuration (`@theme`) instead of `tailwind.config.js`
- The `@tailwindcss/vite` plugin handles content detection automatically
- SVG elements inside tool components should continue using scoped styles with `v-bind()` for dynamic values
- Consider adding `@tailwindcss/typography` later if rich text editing is needed

## References

- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Nuxt + Tailwind v4](https://tailwindcss.com/docs/installation/vite)
