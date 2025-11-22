# Test Strategy & Refactoring Plan

## Current State Analysis

### Test File Breakdown (44 total)

#### Unit Tests (Pure Logic) - KEEP ✓
1. **Stores** (4 files)
   - `stores/annotations.spec.ts` - Core annotation CRUD ✓
   - `stores/history.spec.ts` - Undo/redo logic ✓
   - `stores/renderer.spec.ts` - Canvas/PDF state ✓
   - `stores/settings.spec.ts` - User preferences ✓

2. **Utils** (1 file)
   - `utils/calculations.spec.ts` - Math/geometry functions ✓

3. **Types** (1 file)
   - `types/annotations.spec.ts` - Type guards/validators ✓

**Status**: Keep these. They test pure logic with no UI dependencies.

---

#### Over-Isolated Unit Tests - REFACTOR 🔄

1. **Tool Composables** (6 files) - CONSOLIDATE
   - `composables/tools/useAreaTool.spec.ts`
   - `composables/tools/useFillTool.spec.ts`
   - `composables/tools/useLineTool.spec.ts`
   - `composables/tools/useMeasureTool.spec.ts`
   - `composables/tools/usePerimeterTool.spec.ts`
   - `composables/tools/useTextTool.spec.ts`

   **Problem**: Testing individual tools in isolation with mocked events
   **Solution**: Move to integration tests with real component mounting

2. **Component "Tests"** (3 files) - MISLEADING
   - `components/handles/Transform.spec.ts` - Actually tests STORE logic
   - `components/handles/GroupTransform.spec.ts` - Actually tests STORE logic
   - `components/Layers/PdfViewer.spec.ts` - Needs to mount actual component

   **Problem**: Named like component tests but don't test components
   **Solution**: Either delete or convert to real component integration tests

3. **Transform Base** (1 file)
   - `composables/useTransformBase.spec.ts` - Low-level transform logic

   **Status**: Review if still needed after refactor

---

#### Rotation Tests - MASSIVE DUPLICATION 🚨

**13 files all testing fill rotation** (!!!)
- `tests/rotation/fill-rotation-basic.spec.ts`
- `tests/rotation/fill-rotation-bounds.spec.ts`
- `tests/rotation/fill-rotation-cumulative.spec.ts`
- `tests/rotation/fill-rotation-drag.spec.ts`
- `tests/rotation/fill-rotation-edge-cases.spec.ts`
- `tests/rotation/fill-rotation-interactions.spec.ts`
- `tests/rotation/fill-rotation-position.spec.ts`
- `tests/rotation/fill-rotation-properties.spec.ts`
- `tests/rotation/fill-rotation-real-implementation.spec.ts`
- `tests/rotation/fill-rotation-selection.spec.ts`
- `tests/rotation/fill-rotation-sequences.spec.ts`
- `tests/rotation/fill-rotation-transform.spec.ts`
- `tests/rotation/fill-rotation-visual.spec.ts`

**Plus these rotation-related:**
- `tests/annotation-rotation-required.spec.ts`
- `tests/text-rotation.spec.ts`

**Problem**: Massive over-testing of implementation details, probably written during debugging
**Solution**: Consolidate to 1-2 files with key rotation scenarios

---

#### Integration Tests - EXPAND ✓

Currently only **4 files**:
- `tests/integration/cursor-aware-zoom.spec.ts` ✓
- `tests/integration/mouse-events.spec.ts` ✓
- `tests/integration/svg-coordinates.spec.ts` ✓
- `tests/integration/tool-interaction.spec.ts` ✓

**Problem**: Way too few! Should be the BULK of your tests
**Solution**: This is where we add most new tests

---

#### Feature Tests - CONVERT TO INTEGRATION

- `tests/click-to-deselect.spec.ts`
- `tests/fill-multiselect.spec.ts`
- `tests/selection-interactions.spec.ts`
- `tests/text-minimum-size.spec.ts`

**Status**: Good test subjects, but need to use real components

---

#### Error Handling (4 files) - KEEP BUT ENHANCE ✓
- `tests/error-handling/annotation-validation.spec.ts`
- `tests/error-handling/pdf-errors.spec.ts`
- `tests/error-handling/renderer-validation.spec.ts`
- `tests/error-handling/tool-errors.spec.ts`

**Status**: Keep but add integration-level error scenarios

---

#### Other Composables
- `composables/useKeyboardShortcuts.spec.ts` - May need refactor
- `composables/usePDF.spec.ts` - Keep (PDF parsing logic)

---

## Test Strategy: The Pyramid

```
        /\
       /E2E\         <- 5-10 critical user journeys (Playwright)
      /------\
     /  INT   \      <- 30-40 integration tests (mount components)
    /----------\
   /    UNIT    \    <- 20-30 pure logic tests (calculations, utils)
  /--------------\
```

### Unit Tests (Bottom) - 20-30 files
**Purpose**: Test pure logic, calculations, type guards
**No UI, No Mocks**

Keep:
- Store logic (CRUD, state management)
- Calculations (geometry, measurements)
- Utilities (math, transformations)
- Type validators

### Integration Tests (Middle) - 30-40 files
**Purpose**: Test component interactions, user workflows
**Mount Real Components**

Add:
- Multi-select workflows (Shift+click, Cmd+click, marquee)
- Transform interactions (drag, resize, rotate)
- Tool workflows (draw → select → edit → delete)
- Cross-component state (modifier keys, drag state)
- Event timing (click after drag, double-click)

### E2E Tests (Top) - 5-10 files
**Purpose**: Test critical user journeys end-to-end
**Full App in Browser**

Add:
- Load PDF → annotate → export
- Create multiple annotations → multi-select → transform
- Switch tools → draw → undo → redo
- Mobile/touch interactions
- Error recovery

---

## Refactoring Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Set up Playwright for E2E
- [ ] Create integration test helpers/utilities
- [ ] Define testing conventions (see below)

### Phase 2: Regression Tests (Week 1-2)
- [ ] Add tests for bugs we just fixed:
  - Modifier key sharing
  - Click after drag prevention
  - Marquee selection
  - Multi-select workflows

### Phase 3: Consolidation (Week 2-3)
- [ ] Consolidate 13 rotation tests → 2 files
- [ ] Convert tool composable tests → integration tests
- [ ] Fix misleading component "tests"

### Phase 4: Expansion (Week 3-4)
- [ ] Add integration tests for all major workflows
- [ ] Add E2E tests for critical journeys
- [ ] Achieve 70%+ integration test coverage

### Phase 5: Cleanup (Week 4)
- [ ] Remove obsolete tests
- [ ] Update test documentation
- [ ] Set up CI/CD test reporting

---

## Testing Conventions

### Integration Test Pattern

```typescript
describe('Feature: Multi-Select Annotations', () => {
  describe('Scenario: User selects multiple with Shift+click', () => {
    it('should add to selection when Shift+clicking second annotation', async () => {
      // GIVEN: Two annotations on canvas
      const wrapper = await mountSuspended(SvgAnnotation)
      const anno1 = await createAnnotation({ type: 'text', x: 100, y: 100 })
      const anno2 = await createAnnotation({ type: 'text', x: 200, y: 200 })

      // WHEN: User clicks first, then Shift+clicks second
      await clickAnnotation(wrapper, anno1.id)
      await clickAnnotation(wrapper, anno2.id, { shiftKey: true })

      // THEN: Both are selected
      expect(store.selectedAnnotationIds).toEqual([anno1.id, anno2.id])
      expect(wrapper.find('.group-transform-handles').exists()).toBe(true)
    })
  })
})
```

### E2E Test Pattern

```typescript
test('User Journey: Annotate PDF and Export', async ({ page }) => {
  // GIVEN: User has a PDF loaded
  await page.goto('/editor/test-project')
  await page.waitForSelector('[data-testid="pdf-loaded"]')

  // WHEN: User adds annotations
  await page.click('[data-tool="measure"]')
  await page.click('.pdf-canvas', { position: { x: 100, y: 100 } })
  await page.click('.pdf-canvas', { position: { x: 200, y: 200 } })

  // AND: Exports the result
  await page.click('[data-testid="export-pdf"]')
  const download = await page.waitForEvent('download')

  // THEN: PDF is downloaded with annotations
  expect(download.suggestedFilename()).toContain('.pdf')
})
```

### Test Organization

```
app/
├── tests/
│   ├── unit/              # Pure logic tests
│   │   ├── stores/
│   │   ├── utils/
│   │   └── types/
│   ├── integration/       # Component interaction tests
│   │   ├── selection/     # Multi-select, marquee, etc.
│   │   ├── transforms/    # Drag, resize, rotate
│   │   ├── tools/         # Tool workflows
│   │   └── regression/    # Bug regression tests
│   └── e2e/              # End-to-end journeys
│       ├── annotation-workflow.spec.ts
│       ├── collaboration.spec.ts
│       └── export.spec.ts
```

---

## Success Metrics

### Before Refactor
- 44 test files
- 13 files testing one feature (rotation)
- 4 integration tests
- 0 E2E tests
- Bugs not caught: modifier keys, drag state, marquee

### After Refactor (Target)
- ~30 unit tests (pure logic)
- ~35 integration tests (workflows)
- ~8 E2E tests (critical journeys)
- 70%+ test coverage on user-facing features
- All recent bugs have regression tests

---

## Next Steps

1. Review this plan
2. Decide on priorities (which phases first?)
3. Set up E2E infrastructure (Playwright config)
4. Start with Phase 2 (regression tests for bugs)
5. Gradually refactor existing tests

---

## Quick Wins (Start Here)

### 1. Add Regression Tests for Recent Bugs
File: `tests/integration/regression/multi-select-bugs.spec.ts`

Test:
- Modifier key state sharing
- Click prevention after drag
- Marquee selection

### 2. Consolidate Rotation Tests
Merge 13 files → `tests/integration/rotation/annotation-rotation.spec.ts`

Keep only:
- Basic rotation works
- Cumulative rotations
- Rotation with multi-select
- Edge cases (>360°, negative)

### 3. Convert One Tool Test to Integration
Pick one tool (e.g., text tool) and convert from:
- Isolated composable test with mocks
- To: Full component integration test

This will be the template for others.
