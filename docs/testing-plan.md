# Comprehensive Testing Plan

## Goal
Achieve 100% test coverage for all user interactions, mouse events, transformations, and tool behaviors to prevent regressions as new features are added.

## Testing Framework
- **Test Runner**: Vitest
- **Component Testing**: @vue/test-utils
- **State Management**: Pinia (with createPinia in tests)
- **Mocking**: vi.mock() from Vitest

## Current Test Coverage (102 tests)

### ✅ Completed Tests
- `types/annotations.spec.ts` - 19 tests (Type guards)
- `utils/calculations.spec.ts` - 11 tests (Distance, area, centroid calculations)
- `stores/settings.spec.ts` - 19 tests (Tool configurations)
- `stores/renderer.spec.ts` - 22 tests (PDF viewport state)
- `stores/annotations.spec.ts` - 13 tests (Annotation CRUD operations)
- `composables/tools/useFillTool.spec.ts` - 8 tests (Fill tool)
- `composables/tools/useTextTool.spec.ts` - 10 tests (Text tool)
- `components/handles/Transform.spec.ts` - Basic rotation/move/resize tests
- `composables/useKeyboardShortcuts.spec.ts` - Keyboard shortcut tests

---

## 🎯 Missing Test Coverage

### 1. Tool Composables (High Priority)

#### `useMeasureTool.spec.ts` (NEW)
**What to test:**
- ✅ Click to place first point
- ✅ Click to place second point (completes measurement)
- ✅ Calculate distance between two points
- ✅ Calculate midpoint
- ✅ Real-time preview while hovering (tempEndPoint)
- ✅ Mouse move updates preview
- ✅ Escape key cancels measurement
- ✅ Delete key removes selected measurement
- ✅ Shift key snaps to 45° angles
- ✅ Page awareness (only show current page measurements)
- ✅ Selection behavior
- ✅ Rotation stamping from page rotation
- ✅ Label rotation updates during group rotation

**Estimated tests:** 15-20 tests

#### `useAreaTool.spec.ts` (NEW)
**What to test:**
- ✅ Click to place points (minimum 3 points)
- ✅ Real-time preview polygon while drawing
- ✅ Mouse move updates preview
- ✅ Snap to close polygon (near first point)
- ✅ Click near first point completes polygon
- ✅ Calculate polygon area in m²
- ✅ Calculate centroid (center point)
- ✅ Escape key cancels drawing
- ✅ Delete key removes selected area
- ✅ Shift key snaps to 45° angles
- ✅ Page awareness
- ✅ Selection behavior
- ✅ Rotation stamping
- ✅ Minimum point validation (can't complete with < 3 points)

**Estimated tests:** 15-20 tests

#### `usePerimeterTool.spec.ts` (NEW)
**What to test:**
- ✅ Click to place points (minimum 3 points)
- ✅ Real-time preview polygon
- ✅ Snap to close polygon
- ✅ Calculate total perimeter length
- ✅ Calculate individual segment lengths
- ✅ Calculate centroid
- ✅ Escape key cancels drawing
- ✅ Delete key removes selected perimeter
- ✅ Shift key snaps to 45° angles
- ✅ Page awareness
- ✅ Selection behavior
- ✅ Rotation stamping
- ✅ Segment label positioning

**Estimated tests:** 15-20 tests

#### `useLineTool.spec.ts` (NEW)
**What to test:**
- ✅ Click to place points
- ✅ Real-time preview while drawing
- ✅ Mouse move updates preview
- ✅ Escape key cancels drawing
- ✅ Delete key removes selected line
- ✅ Shift key snaps to 45° angles
- ✅ Page awareness
- ✅ Selection behavior
- ✅ Rotation stamping

**Estimated tests:** 10-15 tests

---

### 2. Transform System (High Priority)

#### `useTransformBase.spec.ts` (NEW)
**What to test:**
- ✅ Initialize drag state correctly
- ✅ Convert screen coordinates to SVG coordinates
- ✅ Start drag sets isDragging = true
- ✅ Start drag captures dragStart point
- ✅ Start drag sets drag mode (resize/rotate/move)
- ✅ Mousemove calculates delta correctly
- ✅ Mousemove triggers appropriate handler (resize/rotate/move)
- ✅ Track hasMoved flag (distinguish click from drag)
- ✅ Mouseup clears isDragging immediately
- ✅ Mouseup clears rotationDragDelta immediately
- ✅ Mouseup calls onEndDrag handler
- ✅ Mouseup cleans up state
- ✅ Shift key tracking (isShiftPressed)
- ✅ Event listener setup and cleanup

**Estimated tests:** 20-25 tests

#### `Transform.spec.ts` (EXPAND EXISTING)
**Current:** Basic rotation/move/resize tests
**Add:**
- ✅ Rotation handle drag updates rotationDragDelta
- ✅ Rotation handle release commits rotation
- ✅ Rotation handle release clears drag delta immediately
- ✅ Rotation respects annotation center point
- ✅ Rotation handle doesn't jump on release
- ✅ Resize corner handles scale annotation
- ✅ Resize maintains aspect ratio with Shift key
- ✅ Move handle drags annotation
- ✅ Transform handles only shown when annotation selected
- ✅ Transform handles hidden when annotation deselected
- ✅ Multiple rotations accumulate correctly
- ✅ History recording for transformations (once Pinia bug fixed)

**Estimated tests:** 25-30 tests (15-20 new)

#### `GroupTransform.spec.ts` (NEW)
**What to test:**
- ✅ Calculate combined bounds from multiple annotations
- ✅ Rotation handle rotates all selected items
- ✅ Real-time rotation preview during drag
- ✅ Rotation handle release commits rotation to all items
- ✅ Rotation handle release clears drag delta immediately
- ✅ Rotation handle doesn't jump/recalculate on release
- ✅ Frozen transformer bounds during rotation
- ✅ Frozen transformer bounds preserved after rotation
- ✅ Cumulative group rotation tracking
- ✅ Unselected annotations don't rotate with group
- ✅ Measurement label rotation during group rotation
- ✅ Resize corner handles scale all selected items
- ✅ Move handle drags all selected items together
- ✅ Group selection state maintained during transform
- ✅ Transform handles shown for multi-select
- ✅ Transform handles hidden when selection cleared
- ✅ History recording for group transformations (once Pinia bug fixed)

**Estimated tests:** 25-30 tests

---

### 3. Store Tests (Expand Existing)

#### `stores/history.spec.ts` (NEW)
**What to test:**
- ✅ Execute command adds to history
- ✅ Undo reverts last command
- ✅ Redo re-applies undone command
- ✅ Undo stack clears on new command after undo
- ✅ Command pattern for CreateAnnotation
- ✅ Command pattern for UpdateAnnotation
- ✅ Command pattern for DeleteAnnotation
- ✅ Command pattern for group operations
- ✅ History limit (max 100 commands)
- ✅ Can undo/redo availability flags
- ✅ Clear history

**Estimated tests:** 15-20 tests

#### `stores/annotations.spec.ts` (EXPAND EXISTING)
**Current:** 13 tests for CRUD operations
**Add:**
- ✅ Multi-select: Add to selection
- ✅ Multi-select: Remove from selection
- ✅ Multi-select: Toggle selection
- ✅ Multi-select: Select all
- ✅ Multi-select: Clear selection
- ✅ Copy selected annotation
- ✅ Paste copied annotation
- ✅ Duplicate annotation (Ctrl+D)
- ✅ Copy/paste with offset
- ✅ Rotation drag delta tracking
- ✅ Get rotation transform
- ✅ Update annotation recalculates derived values

**Estimated tests:** 25-30 tests total (12-17 new)

---

### 4. Integration Tests (NEW)

#### `integration/mouse-events.spec.ts` (NEW)
**What to test:**
- ✅ Click on annotation selects it
- ✅ Click on background deselects
- ✅ Ctrl+Click adds to multi-selection
- ✅ Shift+Click range selection (if implemented)
- ✅ Double-click starts editing (text tool)
- ✅ Drag starts rotation/resize/move
- ✅ Drag updates annotation in real-time
- ✅ Release commits changes
- ✅ Escape during drag cancels operation
- ✅ Mouse events respect current tool
- ✅ Mouse events respect page boundaries

**Estimated tests:** 15-20 tests

#### `integration/keyboard-shortcuts.spec.ts` (EXPAND EXISTING)
**Add comprehensive tests:**
- ✅ Ctrl+Z undoes last action
- ✅ Ctrl+Shift+Z (or Ctrl+Y) redoes
- ✅ Ctrl+C copies selected annotation
- ✅ Ctrl+V pastes annotation
- ✅ Ctrl+D duplicates annotation
- ✅ Delete/Backspace deletes selected
- ✅ Escape deselects annotation
- ✅ Escape cancels drawing
- ✅ Shift during drag snaps to 45°
- ✅ Shift during resize maintains aspect ratio
- ✅ Ctrl+A selects all (if implemented)

**Estimated tests:** 15-20 tests

#### `integration/svg-coordinates.spec.ts` (NEW)
**What to test:**
- ✅ Convert screen coordinates to SVG coordinates
- ✅ Convert SVG coordinates to PDF coordinates
- ✅ Coordinate conversion respects zoom/scale
- ✅ Coordinate conversion respects scroll position
- ✅ Coordinate conversion respects page rotation (0°, 90°, 180°, 270°)
- ✅ getSvgPoint() returns correct coordinates
- ✅ Point transformation with CSS transforms

**Estimated tests:** 10-15 tests

---

### 5. Component Tests (Medium Priority)

#### `components/SimplePdfViewer.spec.ts` (NEW)
**What to test:**
- ✅ Renders PDF canvas element
- ✅ Initializes PDF.js worker
- ✅ Loads PDF from URL
- ✅ Renders current page
- ✅ Applies scale/zoom to canvas
- ✅ Applies scroll position via transform
- ✅ Updates when page changes
- ✅ Updates when scale changes
- ✅ Error handling for invalid PDF
- ✅ Loading state

**Estimated tests:** 12-15 tests

#### `components/SvgAnnotationLayer.spec.ts` (NEW)
**What to test:**
- ✅ Renders SVG overlay
- ✅ SVG dimensions match PDF dimensions
- ✅ SVG transform matches PDF transform
- ✅ Routes mouse events to active tool
- ✅ Shows active tool component
- ✅ Hides inactive tool components
- ✅ Selection box rendering
- ✅ Background click deselects
- ✅ Prevents event bubbling where needed

**Estimated tests:** 12-15 tests

#### `components/tools/Measure.vue.spec.ts` (NEW)
**What to test:**
- ✅ Renders completed measurements
- ✅ Renders preview while drawing
- ✅ Shows distance label
- ✅ Label position at midpoint
- ✅ Label rotation respects line angle
- ✅ Label rotation during group rotation (no lag)
- ✅ Hover state changes stroke width
- ✅ Selection state changes color
- ✅ Click selects measurement
- ✅ Rotation transform applied correctly

**Estimated tests:** 12-15 tests

#### `components/tools/Area.vue.spec.ts` (NEW)
**What to test:**
- ✅ Renders completed areas
- ✅ Renders preview polygon while drawing
- ✅ Shows area label in m²
- ✅ Label position at centroid
- ✅ Polygon path generation
- ✅ Fill opacity
- ✅ Hover state
- ✅ Selection state
- ✅ Click selects area
- ✅ Rotation transform applied

**Estimated tests:** 12-15 tests

#### `components/tools/Perimeter.vue.spec.ts` (NEW)
**What to test:**
- ✅ Renders completed perimeters
- ✅ Renders preview polygon
- ✅ Shows total length label
- ✅ Shows individual segment labels
- ✅ Segment label positioning
- ✅ Hover state
- ✅ Selection state
- ✅ Click selects perimeter
- ✅ Rotation transform applied

**Estimated tests:** 12-15 tests

#### `components/tools/Line.vue.spec.ts` (NEW)
**What to test:**
- ✅ Renders completed lines
- ✅ Renders preview while drawing
- ✅ Polyline path generation
- ✅ Hover state
- ✅ Selection state
- ✅ Click selects line
- ✅ Rotation transform applied

**Estimated tests:** 10-12 tests

---

### 6. Edge Cases and Regression Tests (High Priority)

#### `regression/rotation-bugs.spec.ts` (NEW)
**What to test:**
- ✅ Rotation handle doesn't jump to 0° on release
- ✅ Multiple rotations accumulate correctly
- ✅ Group rotation doesn't affect unselected items
- ✅ Frozen transformer bounds prevent recalculation
- ✅ Cumulative rotation tracking works across multiple sessions
- ✅ Measurement labels don't lag during rotation
- ✅ CSS transitions don't interfere with rotation

**Estimated tests:** 10-12 tests

#### `regression/pinia-bugs.spec.ts` (NEW)
**What to test:**
- ✅ UpdateAnnotationCommand can be instantiated
- ✅ CreateAnnotationCommand can be instantiated
- ✅ DeleteAnnotationCommand can be instantiated
- ✅ History commands work with Pinia proxy
- ✅ Store methods accessible without toRaw()

**Estimated tests:** 5-8 tests (once Pinia bug fixed)

#### `edge-cases/boundary-conditions.spec.ts` (NEW)
**What to test:**
- ✅ Drawing at canvas edges
- ✅ Drawing outside canvas bounds
- ✅ Zero-length measurements
- ✅ Single-point annotations
- ✅ Overlapping annotations
- ✅ Very large annotations
- ✅ Very small annotations
- ✅ Extreme zoom levels
- ✅ Extreme rotation angles (> 360°, negative)

**Estimated tests:** 12-15 tests

---

## Test Execution Strategy

### Phase 1: Tool Composables (Week 1)
1. ✅ useMeasureTool.spec.ts
2. ✅ useAreaTool.spec.ts
3. ✅ usePerimeterTool.spec.ts
4. ✅ useLineTool.spec.ts

**Deliverable:** ~60-80 new tests

### Phase 2: Transform System (Week 2)
1. ✅ useTransformBase.spec.ts
2. ✅ Expand Transform.spec.ts
3. ✅ GroupTransform.spec.ts
4. ✅ stores/history.spec.ts

**Deliverable:** ~80-100 new tests

### Phase 3: Integration Tests (Week 3)
1. ✅ integration/mouse-events.spec.ts
2. ✅ Expand keyboard-shortcuts.spec.ts
3. ✅ integration/svg-coordinates.spec.ts
4. ✅ Expand stores/annotations.spec.ts

**Deliverable:** ~50-70 new tests

### Phase 4: Component Tests (Week 4)
1. ✅ SimplePdfViewer.spec.ts
2. ✅ SvgAnnotationLayer.spec.ts
3. ✅ Tool component tests (Measure, Area, Perimeter, Line)

**Deliverable:** ~50-70 new tests

### Phase 5: Edge Cases and Regressions (Week 5)
1. ✅ regression/rotation-bugs.spec.ts
2. ✅ regression/pinia-bugs.spec.ts
3. ✅ edge-cases/boundary-conditions.spec.ts

**Deliverable:** ~30-40 new tests

---

## Total New Tests Estimate

- **Phase 1:** 60-80 tests
- **Phase 2:** 80-100 tests
- **Phase 3:** 50-70 tests
- **Phase 4:** 50-70 tests
- **Phase 5:** 30-40 tests

**Total new tests:** 270-360 tests
**Current tests:** 102 tests
**Final total:** ~370-460 tests 🎯

---

## Test Coverage Goals

### Unit Test Coverage (Functions/Methods)
- **Target:** 90%+ coverage
- **Priority:** Calculation utilities, tool composables, store actions

### Integration Test Coverage (Interactions)
- **Target:** 80%+ coverage
- **Priority:** Mouse events, keyboard shortcuts, multi-select

### Component Test Coverage (UI)
- **Target:** 70%+ coverage
- **Priority:** Tool components, transform handles

### E2E Coverage (User Flows)
- **Target:** Critical paths only
- **Priority:** Draw → Select → Transform → Undo

---

## Testing Best Practices

### 1. Test File Organization
```
app/
├── composables/
│   ├── tools/
│   │   ├── useMeasureTool.ts
│   │   └── useMeasureTool.spec.ts  // Co-located with implementation
├── components/
│   ├── handles/
│   │   ├── Transform.vue
│   │   └── Transform.spec.ts       // Co-located with component
└── integration/                     // Separate folder for integration tests
    ├── mouse-events.spec.ts
    └── keyboard-shortcuts.spec.ts
```

### 2. Test Naming Convention
```typescript
describe('useMeasureTool', () => {
  describe('Point Placement', () => {
    it('should place first point on click', () => {})
    it('should place second point and complete measurement', () => {})
  })

  describe('45° Angle Snapping', () => {
    it('should snap to nearest 45° when Shift pressed', () => {})
    it('should not snap when Shift released', () => {})
  })
})
```

### 3. Mock Strategy
- Mock PDF.js worker (heavy dependency)
- Mock SVG elements for coordinate conversion
- Don't mock Pinia stores (use real stores in tests)
- Mock UUID for deterministic IDs

### 4. Assertions
- Use `toBeCloseTo()` for floating-point comparisons (measurements, angles)
- Use `toBe()` for primitives and exact matches
- Use `toEqual()` for objects and arrays
- Use `toHaveLength()` for array length checks

### 5. Test Data Factories
Create helper functions for test data:
```typescript
function createTestMeasurement(overrides?: Partial<Measurement>): Measurement {
  return {
    id: 'test-uuid',
    type: 'measure',
    pageNum: 1,
    points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
    distance: 141.42,
    midpoint: { x: 150, y: 150 },
    labelRotation: 0,
    rotation: 0,
    ...overrides
  }
}
```

---

## CI/CD Integration

### Pre-commit Hook
```bash
#!/bin/bash
# Run tests before commit
pnpm test
```

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:coverage
```

---

## Success Metrics

### Definition of Done
- ✅ All critical user interactions tested
- ✅ All tools have comprehensive test coverage
- ✅ Transform system fully tested (rotation, resize, move)
- ✅ Multi-select and group operations tested
- ✅ Undo/redo system tested
- ✅ Regression tests prevent known bugs
- ✅ Tests run in < 30 seconds
- ✅ Tests are deterministic (no flaky tests)
- ✅ Test coverage report generated

### Maintenance
- Update tests when adding new features
- Add regression tests when bugs are found
- Keep tests fast (mock heavy dependencies)
- Review test failures immediately (don't ignore)

---

_Last Updated: 2025-01-22_
_Target Completion: 5 weeks_
_Current Status: Phase 1 - Planning Complete_
