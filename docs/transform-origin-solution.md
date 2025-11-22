# Transform Origin Solution - Zoom & Rotation Compatibility

## The Problem

We have two conflicting requirements:
1. **Rotation** needs `transform-origin: center center` to rotate around the PDF's center
2. **Zoom** is easier with `transform-origin: top left` for simpler math

## The Solution

**Keep `transform-origin: center center`** for both operations, but adjust the zoom math to account for the centering offset.

## The Math Explained

### With `transform-origin: center center`

When CSS applies transforms with center origin, the actual transformation is:

```
screenX = (pdfX - centerX) × scale + centerX + translateX
```

Which simplifies to:

```
screenX = pdfX × scale + translateX + centerX × (1 - scale)
```

### Zoom-to-Point Calculation

To keep a PDF point under the cursor when zooming:

**Step 1: Convert screen coordinates → PDF coordinates**
```typescript
const centerX = pdfWidth / 2
const centerY = pdfHeight / 2

// Inverse of the transform formula
const pdfMouseX = (mouseX - translateX - centerX × (1 - currentScale)) / currentScale
const pdfMouseY = (mouseY - translateY - centerY × (1 - currentScale)) / currentScale
```

**Step 2: Calculate new translate to keep PDF point at same screen position**
```typescript
const newTranslateX = mouseX - pdfMouseX × newScale - centerX × (1 - newScale)
const newTranslateY = mouseY - pdfMouseY × newScale - centerY × (1 - newScale)
```

## Why This Works

### For Rotation
- Rotation naturally works with `center center` origin
- Rotates around the PDF's center point
- No special handling needed

### For Zoom
- Math accounts for the `centerX × (1 - scale)` offset term
- Cursor stays pinned to the same PDF point while zooming
- Works at any position on the PDF, not just extremes

## Benefits

✅ **Single transform-origin** - No need to toggle based on operation
✅ **Rotation works perfectly** - Rotates around center as expected
✅ **Zoom is precise** - Zooms directly towards cursor anywhere on PDF
✅ **Clean code** - All logic centralized in `zoomToScale()` function
✅ **No edge cases** - Works for all scales, rotations, and positions

## Alternative Approaches Considered

### ❌ Toggle transform-origin dynamically
```typescript
transformOrigin: annotationStore.activeTool === 'rotate' ? 'center center' : 'top left'
```
**Rejected:** Creates animation glitches when switching tools, complex state management

### ❌ Separate transforms for scale/rotate
```typescript
transform: `translate(...) scale(...) rotate(...)`
```
**Rejected:** Would need to decompose and recompose transforms, more complex

### ✅ Use center origin + adjusted math (CHOSEN)
**Best:** Single source of truth, clear math, works for all cases

## Implementation Files

- **Zoom logic**: `app/stores/renderer.ts` - `zoomToScale()` function
- **Canvas transform**: `app/components/SimplePdfViewer.vue` - `canvasStyle`
- **SVG transform**: `app/components/SvgAnnotationLayer.vue` - `svgStyle`

## Formula Reference

### Forward Transform (PDF → Screen)
```typescript
screenX = pdfX × scale + translateX + centerX × (1 - scale)
screenY = pdfY × scale + translateY + centerY × (1 - scale)
```

### Inverse Transform (Screen → PDF)
```typescript
pdfX = (screenX - translateX - centerX × (1 - scale)) / scale
pdfY = (screenY - translateY - centerY × (1 - scale)) / scale
```

---

**Last Updated:** 2025-01-22
**Status:** ✅ Implemented and Working
