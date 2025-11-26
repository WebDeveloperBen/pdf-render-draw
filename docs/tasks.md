# Tasks

## Test Coverage & Quality

### 1. E2E Testing with Playwright

**Priority:** High
**Status:** � To Do

Create comprehensive E2E tests using Playwright to validate visual and interactive behavior.

#### 1.1 Transform Handle Tests

**File:** `tests/e2e/transform-handles.spec.ts`

Test that transform handles render correctly and respond to user interaction:

- [ ] Handles appear when annotation is selected
- [ ] Correct number of handles for each annotation type
- [ ] Handles positioned correctly at corners/edges
- [ ] Handles scale with viewport zoom
- [ ] Rotation handle appears and functions
- [ ] Handles disappear when deselected

#### 1.2 Scaling Tests

**File:** `tests/e2e/annotation-scaling.spec.ts`

Test scaling behavior for all annotation types:

- [ ] **Fill**: Scale from corner handles, maintains aspect ratio with shift
- [ ] **Text**: Scale updates width/height, font remains readable
- [ ] **Measure**: Endpoints move, distance recalculates
- [ ] **Area**: Polygon points scale proportionally
- [ ] **Perimeter**: Points scale proportionally
- [ ] **Line**: Endpoints scale from center
- [ ] **Count**: Position and radius scale

Edge cases:

- [ ] Minimum size constraints
- [ ] Scale from different handles (NW, NE, SE, SW)
- [ ] Scale while rotated
- [ ] Multi-select scaling

#### 1.3 Rotation Tests

**File:** `tests/e2e/annotation-rotation.spec.ts`

Test rotation behavior:

- [ ] **Single annotation**: Rotate around center
- [ ] **Multi-select**: Rotate around group center
- [ ] Rotation handle drag interaction
- [ ] Rotation visual feedback during drag
- [ ] Derived values recalculate (midpoint, labelRotation)
- [ ] Labels remain readable (counter-rotation)

Edge cases:

- [ ] Rotate Fill (x, y, width, height + rotation)
- [ ] Rotate Text (same structure)
- [ ] Rotate point-based annotations (points transformed)
- [ ] Rotation persists through save/load

#### 1.4 Moving/Dragging Tests

**File:** `tests/e2e/annotation-moving.spec.ts`

Test move behavior:

- [ ] **Single annotation**: Click and drag moves annotation
- [ ] **Multi-select**: All selected annotations move together
- [ ] Move maintains relative positions in group
- [ ] Boundary constraints (stay within viewport)
- [ ] Move updates all derived values
- [ ] Move works at different zoom levels

Edge cases:

- [ ] Move while rotated
- [ ] Move after scaling
- [ ] Move measurement updates midpoint
- [ ] Move area updates centroid

#### 1.5 Selection Tests

**File:** `tests/e2e/annotation-selection.spec.ts`

Test selection behavior:

- [ ] Click to select single annotation
- [ ] Click empty area deselects
- [ ] Shift+click adds to selection
- [ ] Ctrl/Cmd+click toggles selection
- [ ] Marquee/box selection (if implemented)
- [ ] Selection visual feedback (handles appear)
- [ ] Tab cycles through annotations

#### 1.6 Tool Interaction Tests

**File:** `tests/e2e/tool-interactions.spec.ts`

Test creating annotations with each tool:

- [ ] **Fill**: Click-drag creates rectangle
- [ ] **Text**: Click creates text, double-click to edit
- [ ] **Measure**: Click-click creates measurement
- [ ] **Area**: Click points, close polygon
- [ ] **Perimeter**: Click points, finish
- [ ] **Line**: Click-click creates line
- [ ] **Count**: Click places numbered marker

#### 1.7 Keyboard Shortcuts Tests

**File:** `tests/e2e/keyboard-shortcuts.spec.ts`

Test keyboard interaction:

- [ ] Delete/Backspace removes selected
- [ ] Escape deselects
- [ ] Cmd/Ctrl+Z undos
- [ ] Cmd/Ctrl+Shift+Z redos
- [ ] Cmd/Ctrl+C copies
- [ ] Cmd/Ctrl+V pastes
- [ ] Cmd/Ctrl+D duplicates

---

### 2. Unit Test Coverage Goals

**Priority:** Medium
**Status:** � To Do

Achieve 100% coverage on critical paths:

#### Stores

- [ ] `stores/annotations.ts` - CRUD, validation, selection
- [ ] `stores/history.ts` - Undo/redo commands
- [ ] `stores/renderer.ts` - Zoom, rotation, page navigation

#### Utils

- [ ] `utils/editor/bounds.ts` - Bounds calculations
- [ ] `utils/editor/derived-values.ts` - Type guards, recalculation
- [ ] `utils/editor/transform.ts` - Math functions

#### Composables

- [ ] `composables/tools/*` - Each tool's logic
- [ ] `composables/editor/*` - Transform, bounds, selection

---

## Test Commands

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/error-handling/annotation-validation.spec.ts

# Run E2E tests (Playwright)
pnpm exec playwright test

# Run E2E with UI
pnpm exec playwright test --ui
```

---

## Test Fixtures

Create reusable test fixtures in `tests/fixtures/`:

```typescript
// tests/fixtures/annotations.ts
export const createTestFill = (overrides = {}) => ({
  id: "test-fill-1",
  type: "fill",
  pageNum: 1,
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  color: "#ff0000",
  opacity: 0.5,
  rotation: 0,
  ...overrides
})

export const createTestMeasurement = (overrides = {}) => ({
  id: "test-measure-1",
  type: "measure",
  pageNum: 1,
  points: [
    { x: 100, y: 100 },
    { x: 200, y: 100 }
  ],
  distance: 100,
  midpoint: { x: 150, y: 100 },
  labelRotation: 0,
  rotation: 0,
  ...overrides
})

// ... more fixtures
```

---
