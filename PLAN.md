# V2 Editor - FINAL Spec-Driven Development Plan

**Date:** 2025-01-24
**Status:** Planning Phase - FINAL (Ambitious & Correct Scope)

---

## Executive Summary

**The Big Idea:** Move ALL transform responsibility from individual tools into shared V2 composables.

**Current Problem:**
- Each tool implements its own `applyRotation`, `applyMove`, `applyResize`
- 6 tools × 3 transform methods = **18 duplicate implementations**
- Each implementation has to understand point-based vs positioned
- Each implementation has to recalculate derived values (distance, area, center)
- Bugs in one tool's transform don't get fixed in others

**V2 Solution:**
- Composables handle ALL transforms for ALL annotation types
- Tools just provide their shape data and drawing logic
- Zero transform code in tools
- One implementation, tested once, works for all tools

---

## Architecture Shift

### Before (V1) - Tools Own Transforms

```typescript
// useMeasureTool.ts - 120 lines
registerTool({
  transform: {
    getCenter: (annotation) => { /* measure-specific logic */ },
    applyRotation: (annotation, delta) => { /* measure-specific logic */ },
    applyMove: (annotation, dx, dy) => { /* measure-specific logic */ },
    applyResize: (annotation, bounds) => { /* measure-specific logic */ }
  }
})

// useAreaTool.ts - 134 lines
registerTool({
  transform: {
    getCenter: (annotation) => { /* area-specific logic */ },
    applyRotation: (annotation, delta) => { /* area-specific logic */ },
    applyMove: (annotation, dx, dy) => { /* area-specific logic */ },
    applyResize: (annotation, bounds) => { /* area-specific logic */ }
  }
})

// ... repeated for 6 tools
```

**Problems:**
- ❌ 18 transform implementations to maintain
- ❌ Inconsistent behavior between tools
- ❌ Bugs duplicated across tools
- ❌ Each tool has to understand point-based vs positioned
- ❌ Each tool recalculates derived values

---

### After (V2) - Composables Own Transforms

```typescript
// useMeasureTool.ts - 40 lines (80% smaller!)
const [useMeasureTool] = createInjectionState(() => {
  const base = useCreateBaseTool()
  const drawing = useDrawingTool({
    type: "measure",
    minPoints: 2,
    calculate: (points) => ({
      points,
      distance: calculateDistance(points[0], points[1]),
      midpoint: calculateMidpoint(points[0], points[1])
    })
  })

  // That's it! No transform logic needed
  return { ...base, ...drawing }
})

// useAreaTool.ts - 45 lines (66% smaller!)
const [useAreaTool] = createInjectionState(() => {
  const base = useCreateBaseTool()
  const drawing = useDrawingTool({
    type: "area",
    minPoints: 3,
    calculate: (points) => ({
      points,
      area: calculatePolygonArea(points),
      center: calculateCentroid(points)
    })
  })

  // That's it! No transform logic needed
  return { ...base, ...drawing }
})
```

**Benefits:**
- ✅ 1 transform implementation for all tools
- ✅ Consistent behavior everywhere
- ✅ Fix once, fixed everywhere
- ✅ Composables understand point-based vs positioned
- ✅ Composables recalculate derived values
- ✅ Tools 60-80% smaller

---

## How Composables Handle All Annotation Types

### useEditorRotation.ts - Smart Type Detection

```typescript
export const useEditorRotation = createSharedComposable(() => {
  function applyRotation(annotation: Annotation, delta: number) {
    // Point-based annotations (measure, area, perimeter, line)
    if ('points' in annotation && Array.isArray(annotation.points)) {
      const center = getAnnotationCenter(annotation)
      const rotatedPoints = rotatePointsAroundCenter(
        annotation.points,
        center,
        delta
      )

      // Recalculate derived values based on type
      const updates = { points: rotatedPoints }

      if (annotation.type === 'measure') {
        updates.distance = calculateDistance(rotatedPoints[0], rotatedPoints[1])
        updates.midpoint = calculateMidpoint(rotatedPoints[0], rotatedPoints[1])
      } else if (annotation.type === 'area') {
        updates.area = calculatePolygonArea(rotatedPoints)
        updates.center = calculateCentroid(rotatedPoints)
      } else if (annotation.type === 'perimeter') {
        updates.perimeter = calculatePerimeter(rotatedPoints)
        updates.center = calculateCentroid(rotatedPoints)
      }

      return updates
    }

    // Positioned annotations (fill, text, count)
    if ('x' in annotation && 'y' in annotation && 'width' in annotation) {
      const center = {
        x: annotation.x + annotation.width / 2,
        y: annotation.y + annotation.height / 2
      }

      // Rotate shape itself
      const newRotation = (annotation.rotation || 0) + delta

      // Orbit: rotate center point around selection center
      const selectionCenter = getSelectionCenter()
      const rotatedCenter = rotatePointAroundCenter(center, selectionCenter, delta)

      return {
        x: rotatedCenter.x - annotation.width / 2,
        y: rotatedCenter.y - annotation.height / 2,
        rotation: newRotation
      }
    }

    return {}
  }

  return { applyRotation }
})
```

**Key Insight:** Composable knows how to handle **every annotation type**. Tools don't need to!

---

### useEditorScale.ts - Smart Recalculation

```typescript
export const useEditorScale = createSharedComposable(() => {
  function applyScale(
    annotation: Annotation,
    newBounds: Bounds,
    originalBounds: Bounds
  ) {
    // Point-based: scale points to new bounds
    if ('points' in annotation && Array.isArray(annotation.points)) {
      const scaledPoints = scalePointsToNewBounds(
        annotation.points,
        originalBounds,
        newBounds
      )

      // Recalculate ALL derived values based on type
      const updates = { points: scaledPoints }

      switch (annotation.type) {
        case 'measure':
          updates.distance = calculateDistance(scaledPoints[0], scaledPoints[1])
          updates.midpoint = calculateMidpoint(scaledPoints[0], scaledPoints[1])
          break

        case 'area':
          updates.area = calculatePolygonArea(scaledPoints)
          updates.center = calculateCentroid(scaledPoints)
          break

        case 'perimeter':
          updates.perimeter = calculatePerimeter(scaledPoints)
          updates.center = calculateCentroid(scaledPoints)
          break

        case 'line':
          // Line has no derived values
          break
      }

      return updates
    }

    // Positioned: scale dimensions and position
    if ('x' in annotation && 'width' in annotation) {
      const scaleX = newBounds.width / originalBounds.width
      const scaleY = newBounds.height / originalBounds.height

      return {
        x: newBounds.x + (annotation.x - originalBounds.x) * scaleX,
        y: newBounds.y + (annotation.y - originalBounds.y) * scaleY,
        width: annotation.width * scaleX,
        height: annotation.height * scaleY
      }
    }

    return {}
  }

  return { applyScale }
})
```

**Key Insight:** Composable automatically recalculates derived values (distance, area, etc.) based on annotation type!

---

### useEditorMove.ts - Simple but Universal

```typescript
export const useEditorMove = createSharedComposable(() => {
  function applyMove(annotation: Annotation, deltaX: number, deltaY: number) {
    // Point-based: translate points
    if ('points' in annotation && Array.isArray(annotation.points)) {
      const movedPoints = translatePoints(annotation.points, deltaX, deltaY)

      // Recalculate derived values
      const updates = { points: movedPoints }

      switch (annotation.type) {
        case 'measure':
          updates.midpoint = calculateMidpoint(movedPoints[0], movedPoints[1])
          // Distance doesn't change when moving
          break

        case 'area':
        case 'perimeter':
          updates.center = calculateCentroid(movedPoints)
          // Area/perimeter don't change when moving
          break
      }

      return updates
    }

    // Positioned: translate position
    if ('x' in annotation && 'y' in annotation) {
      return {
        x: annotation.x + deltaX,
        y: annotation.y + deltaY
      }
    }

    return {}
  }

  return { applyMove }
})
```

---

## Complete V2 Architecture

### Composable Hierarchy

```
useEditorSelection.ts         ← Selection state (IDs, multi-select)
    ↓ uses
useEditorBounds.ts            ← Bounds calculation (frozen during rotation)
    ↓ uses
useEditorRotation.ts          ← Rotation (handles ALL annotation types)
useEditorScale.ts             ← Scaling (handles ALL annotation types)
useEditorMove.ts              ← Moving (handles ALL annotation types)
useEditorMarquee.ts           ← Marquee selection
    ↓ all use
useEditorCoordinates.ts       ← Screen ↔ SVG conversion
useEditorEventHandlers.ts     ← Event routing
```

### Tool Simplification

**Before (V1):**
```
useMeasureTool.ts       120 lines (80 lines transform logic)
useAreaTool.ts          134 lines (86 lines transform logic)
usePerimeterTool.ts     130 lines (82 lines transform logic)
useLineTool.ts          110 lines (70 lines transform logic)
useTextTool.ts          150 lines (95 lines transform logic)
useCountTool.ts         115 lines (75 lines transform logic)
─────────────────────────────────────────────────────
TOTAL:                  759 lines (488 lines transform)
```

**After (V2):**
```
useMeasureTool.ts       40 lines (drawing only)
useAreaTool.ts          45 lines (drawing only)
usePerimeterTool.ts     42 lines (drawing only)
useLineTool.ts          35 lines (drawing only)
useTextTool.ts          55 lines (drawing only)
useCountTool.ts         38 lines (drawing only)
─────────────────────────────────────────────────────
TOTAL:                  255 lines (0 lines transform)

Transform Composables:  350 lines (handles ALL tools)
─────────────────────────────────────────────────────
NET REDUCTION:          154 lines saved (20% smaller)
```

**More importantly:**
- ✅ Transform bugs fixed once for all tools
- ✅ New tools get transforms for free
- ✅ Tools focus on domain logic (measurement, drawing)

---

## File Structure

### New V2 Files

```
app/
├── composables/
│   └── editor/
│       ├── useEditorSelection.ts       # Selection state & operations
│       ├── useEditorBounds.ts          # Bounds calc (frozen pattern)
│       ├── useEditorRotation.ts        # Rotation for ALL types
│       ├── useEditorScale.ts           # Scaling for ALL types
│       ├── useEditorMove.ts            # Moving for ALL types
│       ├── useEditorMarquee.ts         # Marquee selection
│       ├── useEditorCoordinates.ts     # SVG coordinate conversion
│       └── useEditorEventHandlers.ts   # Event routing
│
├── components/
│   └── editor/
│       └── v2/
│           ├── AnnotationLayer.vue      # Orchestrator
│           ├── TransformHandles.vue     # Unified handles
│           ├── RotationHandle.vue       # Rotation handle
│           ├── ScaleHandles.vue         # 8 scale handles
│           └── SelectionMarquee.vue     # Marquee rectangle
│
├── utils/
│   └── editor/
│       ├── bounds.ts                    # Bounds utilities
│       ├── transform.ts                 # Transform math
│       ├── coordinates.ts               # Coordinate conversion
│       ├── intersection.ts              # AABB collision
│       └── derived-values.ts            # Recalc distance, area, etc.
│
└── types/
    └── editor.ts                        # V2 types
```

### Tool Files (Simplified in V2)

```
app/
└── composables/
    └── tools/
        ├── useMeasureTool.ts            # 🔄 40 lines (was 120)
        ├── useAreaTool.ts               # 🔄 45 lines (was 134)
        ├── usePerimeterTool.ts          # 🔄 42 lines (was 130)
        ├── useLineTool.ts               # 🔄 35 lines (was 110)
        ├── useTextTool.ts               # 🔄 55 lines (was 150)
        └── useCountTool.ts              # 🔄 38 lines (was 115)
```

### Files to Delete After V2

```
app/
├── components/
│   └── handles/
│       ├── Transform.vue                # ❌ Delete (370 lines)
│       └── GroupTransform.vue           # ❌ Delete (540 lines)
│
└── composables/
    ├── useTransformBase.ts              # ❌ Delete (merged into V2)
    ├── useDragState.ts                  # ❌ Delete (merged into V2)
    └── useSelectionMarquee.ts           # ❌ Delete (V2 has better version)
```

---

## Phase-by-Phase Implementation

### Phase 1: Core Transform Composables (4-5 days)

#### Step 1.1: Derived Values Utility

**File:** `app/utils/editor/derived-values.ts`

**Purpose:** Centralize all derived value calculations

```typescript
import type { Annotation, Measurement, Area, Perimeter } from '~/types/annotations'

/**
 * Recalculate derived values for an annotation after transform
 */
export function recalculateDerivedValues(annotation: Annotation): Partial<Annotation> {
  const updates: Partial<Annotation> = {}

  switch (annotation.type) {
    case 'measure': {
      const measure = annotation as Measurement
      if (measure.points.length === 2) {
        updates.distance = calculateDistance(measure.points[0], measure.points[1])
        updates.midpoint = calculateMidpoint(measure.points[0], measure.points[1])
      }
      break
    }

    case 'area': {
      const area = annotation as Area
      if (area.points.length >= 3) {
        updates.area = calculatePolygonArea(area.points)
        updates.center = calculateCentroid(area.points)
      }
      break
    }

    case 'perimeter': {
      const perimeter = annotation as Perimeter
      if (perimeter.points.length >= 2) {
        updates.perimeter = calculatePerimeter(perimeter.points)
        updates.center = calculateCentroid(perimeter.points)
      }
      break
    }

    case 'line':
    case 'fill':
    case 'text':
    case 'count':
      // No derived values
      break
  }

  return updates
}

/**
 * Get rotation center for any annotation type
 */
export function getAnnotationCenter(annotation: Annotation): Point {
  // Point-based: use centroid or midpoint
  if ('points' in annotation && Array.isArray(annotation.points)) {
    if (annotation.points.length === 2) {
      return calculateMidpoint(annotation.points[0], annotation.points[1])
    }
    return calculateCentroid(annotation.points)
  }

  // Positioned: use geometric center
  if ('x' in annotation && 'width' in annotation) {
    return {
      x: annotation.x + annotation.width / 2,
      y: annotation.y + annotation.height / 2
    }
  }

  return { x: 0, y: 0 }
}
```

**Tests:** `app/utils/editor/derived-values.spec.ts`
- ✅ Recalculate measure distance/midpoint
- ✅ Recalculate area area/center
- ✅ Recalculate perimeter perimeter/center
- ✅ Get center for all annotation types

---

#### Step 1.2: Selection Composable

**File:** `app/composables/editor/useEditorSelection.ts`

*(Same as revised plan - no changes)*

---

#### Step 1.3: Bounds Composable with Frozen Pattern

**File:** `app/composables/editor/useEditorBounds.ts`

*(Same as revised plan - no changes)*

---

#### Step 1.4: Rotation Composable (Handles All Types)

**File:** `app/composables/editor/useEditorRotation.ts`

**Purpose:** Rotation for ALL annotation types

```typescript
import { useEditorSelection } from './useEditorSelection'
import { useEditorBounds } from './useEditorBounds'
import { useEditorCoordinates } from './useEditorCoordinates'
import { useAnnotationStoreV2 } from '~/stores/v2/annotations'
import { rotatePointsAroundCenter, rotatePointAroundCenter } from '~/utils/editor/transform'
import { recalculateDerivedValues, getAnnotationCenter } from '~/utils/editor/derived-values'
import type { Annotation, Point, Bounds } from '~/types/editor'

export const useEditorRotation = createSharedComposable(() => {
  const selection = useEditorSelection()
  const bounds = useEditorBounds()
  const coordinates = useEditorCoordinates()
  const annotationStore = useAnnotationStoreV2()

  // State
  const isRotating = ref(false)
  const rotationStartAngle = ref(0)
  const rotationCenter = ref<Point | null>(null)
  const lockedBounds = ref<Bounds | null>(null)
  const originalAnnotations = ref<Map<string, Annotation>>(new Map())

  function startRotation(event: MouseEvent) {
    const point = coordinates.convertToSvgPoint(event)
    const center = bounds.selectionCenter.value

    if (!point || !center) return

    // CRITICAL: Lock bounds before rotation
    lockedBounds.value = bounds.selectionBounds.value

    // Store originals
    originalAnnotations.value.clear()
    for (const annotation of selection.selectedAnnotations.value) {
      originalAnnotations.value.set(
        annotation.id,
        JSON.parse(JSON.stringify(annotation))
      )
    }

    isRotating.value = true
    rotationCenter.value = center
    rotationStartAngle.value = Math.atan2(
      point.y - center.y,
      point.x - center.x
    )

    coordinates.cacheSvg(event.currentTarget as SVGSVGElement)
  }

  function updateRotation(event: MouseEvent) {
    if (!isRotating.value || !rotationCenter.value) return

    const point = coordinates.convertToSvgPoint(event)
    if (!point) return

    const currentAngle = Math.atan2(
      point.y - rotationCenter.value.y,
      point.x - rotationCenter.value.x
    )
    const rotationDelta = currentAngle - rotationStartAngle.value

    // Apply rotation to all selected (handles ALL types)
    for (const annotation of selection.selectedAnnotations.value) {
      const original = originalAnnotations.value.get(annotation.id)
      if (!original) continue

      const updates = applyRotation(original, rotationDelta, rotationCenter.value)
      annotationStore.updateAnnotation(annotation.id, updates)
    }
  }

  /**
   * Apply rotation to ANY annotation type
   */
  function applyRotation(
    annotation: Annotation,
    rotationDelta: number,
    selectionCenter: Point
  ): Partial<Annotation> {
    // Point-based annotations
    if ('points' in annotation && Array.isArray(annotation.points)) {
      const center = getAnnotationCenter(annotation)
      const rotatedPoints = rotatePointsAroundCenter(
        annotation.points,
        center,
        rotationDelta
      )

      // Orbit: rotate center around selection center (for multi-select)
      if (selection.isMultiSelection.value) {
        const rotatedCenter = rotatePointAroundCenter(
          center,
          selectionCenter,
          rotationDelta
        )

        const offset = {
          x: rotatedCenter.x - center.x,
          y: rotatedCenter.y - center.y
        }

        const orbitedPoints = rotatedPoints.map(p => ({
          x: p.x + offset.x,
          y: p.y + offset.y
        }))

        const updates = { points: orbitedPoints }
        const derived = recalculateDerivedValues({
          ...annotation,
          points: orbitedPoints
        })

        return { ...updates, ...derived }
      }

      // Single selection: just rotate points
      const updates = { points: rotatedPoints }
      const derived = recalculateDerivedValues({
        ...annotation,
        points: rotatedPoints
      })

      return { ...updates, ...derived }
    }

    // Positioned annotations
    if ('x' in annotation && 'y' in annotation && 'width' in annotation) {
      const currentRotation = annotation.rotation || 0
      const newRotation = currentRotation + rotationDelta

      // Orbit for multi-select
      if (selection.isMultiSelection.value) {
        const center = {
          x: annotation.x + annotation.width / 2,
          y: annotation.y + annotation.height / 2
        }

        const rotatedCenter = rotatePointAroundCenter(
          center,
          selectionCenter,
          rotationDelta
        )

        return {
          x: rotatedCenter.x - annotation.width / 2,
          y: rotatedCenter.y - annotation.height / 2,
          rotation: newRotation
        }
      }

      // Single selection: just rotate
      return { rotation: newRotation }
    }

    return {}
  }

  function endRotation() {
    isRotating.value = false
    rotationCenter.value = null
    originalAnnotations.value.clear()
    coordinates.clearSvgCache()
    // KEEP lockedBounds until selection changes
  }

  // Clear locked bounds on selection change
  watch(() => selection.selectedIds.value, () => {
    lockedBounds.value = null
  }, { deep: true })

  return {
    isRotating: readonly(isRotating),
    lockedBounds: readonly(lockedBounds),
    startRotation,
    updateRotation,
    endRotation
  }
})
```

**Tests:** `app/composables/editor/useEditorRotation.spec.ts`
- ✅ Locks bounds on rotation start
- ✅ Rotates measure annotations (point-based)
- ✅ Rotates area annotations (point-based)
- ✅ Rotates text annotations (positioned)
- ✅ Recalculates derived values (distance, area, etc.)
- ✅ Orbits annotations in multi-select
- ✅ Keeps locked bounds after rotation
- ✅ Clears locked bounds on selection change

---

#### Step 1.5: Scale Composable (Handles All Types)

**File:** `app/composables/editor/useEditorScale.ts`

*(Similar pattern to rotation - handles all types, recalculates derived values)*

**Tests:**
- ✅ Scales measure annotations
- ✅ Scales area annotations
- ✅ Scales text annotations
- ✅ Recalculates derived values
- ✅ Enforces minimum size
- ✅ Handles aspect ratio (Shift+drag)

---

#### Step 1.6: Move Composable (Handles All Types)

**File:** `app/composables/editor/useEditorMove.ts`

*(Simplest - just translate points or position, recalc derived values)*

**Tests:**
- ✅ Moves measure annotations
- ✅ Moves area annotations
- ✅ Moves text annotations
- ✅ Recalculates position-dependent derived values (midpoint, center)
- ✅ Preserves non-position derived values (distance, area don't change)

---

#### Step 1.7: Marquee Composable

**File:** `app/composables/editor/useEditorMarquee.ts`

*(Same as revised plan - enhanced version of existing marquee)*

---

### Phase 2: UI Components (2-3 days)

*(Same as revised plan - TransformHandles, RotationHandle, ScaleHandles, SelectionMarquee)*

---

### Phase 3: Tool Simplification (2-3 days)

**Goal:** Remove transform logic from all tools

#### For Each Tool:

**Before:**
```typescript
registerTool({
  transform: {
    getCenter: (ann) => ...,
    applyRotation: (ann, delta) => ...,
    applyMove: (ann, dx, dy) => ...,
    applyResize: (ann, bounds) => ...
  }
})
```

**After:**
```typescript
registerTool({
  // No transform config needed!
  // V2 composables handle everything
})
```

**Tools to simplify:**
1. useMeasureTool.ts
2. useAreaTool.ts
3. usePerimeterTool.ts
4. useLineTool.ts
5. useTextTool.ts
6. useCountTool.ts

---

### Phase 4: Integration & Testing (2-3 days)

- Integration tests for all annotation types
- Cross-tool consistency tests
- Performance tests
- Visual regression tests

---

## Testing Strategy

### Comprehensive Cross-Tool Tests

```typescript
// tests/integration/transform-consistency.spec.ts
describe('Transform Consistency Across Tools', () => {
  const tools = ['measure', 'area', 'perimeter', 'line', 'fill', 'text', 'count']

  for (const toolType of tools) {
    describe(`${toolType} annotations`, () => {
      it('should rotate correctly', () => {
        // Create annotation of this type
        // Rotate it
        // Verify bounds, position, derived values
      })

      it('should scale correctly', () => {
        // Create annotation of this type
        // Scale it
        // Verify bounds, dimensions, derived values
      })

      it('should move correctly', () => {
        // Create annotation of this type
        // Move it
        // Verify position, derived values
      })
    })
  }
})
```

**This test ensures ALL tools behave identically!**

---

## Success Criteria

### Functional

✅ Rotation works for all 7 annotation types
✅ Scaling works for all 7 annotation types
✅ Moving works for all 7 annotation types
✅ Derived values recalculated automatically
✅ Frozen bounds prevents jumping
✅ Marquee selection working

### Code Quality

✅ Zero transform code in tools
✅ 488 lines of duplicate transform logic removed
✅ One implementation for all types
✅ Fix once, fixed everywhere
✅ New tools get transforms for free

### Testing

✅ 100+ unit tests for composables
✅ Cross-tool consistency tests
✅ All existing tool tests still passing

---

## Timeline (REALISTIC)

- **Phase 1** (Core composables): 4-5 days
  - Rotation composable (handles all types): 2 days
  - Scale composable (handles all types): 1.5 days
  - Move composable (handles all types): 0.5 days
  - Marquee composable: 1 day

- **Phase 2** (UI components): 2-3 days
  - Unified transform handles: 2 days
  - Integration with composables: 1 day

- **Phase 3** (Tool simplification): 2-3 days
  - Remove transform logic from 6 tools: 2 days
  - Update tests: 1 day

- **Phase 4** (Integration & testing): 2-3 days
  - Cross-tool tests: 1 day
  - Integration tests: 1 day
  - Bug fixes: 1 day

**Total:** 10-14 days

This is the REAL scope with ALL transform responsibility in composables!
