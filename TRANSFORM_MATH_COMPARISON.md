# Transform Math: Before vs After

This document shows the improvement from using the `transformation-matrix` library instead of manual matrix math.

## Bundle Size Impact

- **transformation-matrix**: ~5kb gzipped
- **Trade-off**: Worth it for cleaner, less error-prone code

## Code Comparison

### Rotating Points Around a Center

**Before (Manual Math):**
```typescript
const rotatedPoints = originalAnn.points.map((p: Point) => {
  const dx = p.x - centerX
  const dy = p.y - centerY
  const cos = Math.cos(rotationDelta)
  const sin = Math.sin(rotationDelta)
  return {
    x: centerX + dx * cos - dy * sin,
    y: centerY + dx * sin + dy * cos
  }
})
```

**After (transformation-matrix):**
```typescript
const rotatedPoints = rotatePointsAroundCenter(
  originalAnn.points,
  { x: centerX, y: centerY },
  rotationDelta
)
```

**Benefits:**
- ✅ 6 lines → 4 lines
- ✅ No manual sin/cos calculations
- ✅ Self-documenting (function name explains intent)
- ✅ Reusable across codebase
- ✅ Less chance of sign errors

---

### Translating Points

**Before:**
```typescript
const movedPoints = originalAnn.points.map((p: Point) => ({
  x: p.x + deltaX,
  y: p.y + deltaY
}))
```

**After:**
```typescript
const movedPoints = translatePoints(originalAnn.points, deltaX, deltaY)
```

**Benefits:**
- ✅ More explicit (name shows it's a translation)
- ✅ Consistent API with other transform functions
- ✅ Could easily add more complex transforms if needed

---

### Scaling Points to New Bounds

**Before:**
```typescript
const scaledPoints = originalAnn.points.map((p: Point) => ({
  x: newBounds.x + (p.x - transformBase.originalBounds.value!.x) * scaleX,
  y: newBounds.y + (p.y - transformBase.originalBounds.value!.y) * scaleY
}))
```

**After:**
```typescript
const scaledPoints = scalePointsToNewBounds(
  originalAnn.points,
  transformBase.originalBounds.value!,
  newBounds
)
```

**Benefits:**
- ✅ Much more readable
- ✅ Clear what's happening (scale from original bounds to new bounds)
- ✅ Hides the math complexity
- ✅ Easy to test in isolation

---

### Rotating a Single Point (Positioned Tools)

**Before:**
```typescript
const dx = annCenterX - centerX
const dy = annCenterY - centerY
const cos = Math.cos(transformBase.currentRotationDelta.value)
const sin = Math.sin(transformBase.currentRotationDelta.value)
const rotatedCenterX = centerX + dx * cos - dy * sin
const rotatedCenterY = centerY + dx * sin + dy * cos

const newX = rotatedCenterX - originalAnn.width / 2
const newY = rotatedCenterY - originalAnn.height / 2
```

**After:**
```typescript
const rotatedCenter = rotatePointAroundCenter(
  { x: annCenterX, y: annCenterY },
  { x: centerX, y: centerY },
  transformBase.currentRotationDelta.value
)

const newX = rotatedCenter.x - originalAnn.width / 2
const newY = rotatedCenter.y - originalAnn.height / 2
```

**Benefits:**
- ✅ 8 lines → 6 lines
- ✅ Eliminates manual trig
- ✅ Clear rotation intent
- ✅ Easier to debug (can test rotatePointAroundCenter separately)

---

## The Helper Functions

All the math is now in `utils/transform-math.ts`:

```typescript
// Clean, reusable, testable functions:
export function rotatePointAroundCenter(...)
export function rotatePointsAroundCenter(...)
export function scalePointsToNewBounds(...)
export function translatePoints(...)
export function scalePointsAroundCenter(...)
```

## What's Still Manual

Some things still use manual math where it's clearer:
- Simple x/y position updates for positioned tools
- Bounding box calculations
- Centroid calculations

These are simple enough that adding a library doesn't help.

## Future Additions

If you need more complex transforms, you can easily add:
- `skewPoints()` - for shearing transforms
- `composeTransforms()` - for chaining multiple transforms
- `decompose()` - for extracting rotation/scale from existing transforms

The library handles all the matrix math internally!

## Verdict

**Worth it?** ✅ YES

- Cleaner code
- Less error-prone
- Easier to maintain
- Small bundle cost (~5kb)
- Your domain logic is still custom - you're just delegating the math
