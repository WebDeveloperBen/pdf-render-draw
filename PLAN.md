Below is a succinct but detailed, spec-driven development + testing plan designed exactly for what you’re doing: debugging + rebuilding an SVG editor with multi-select, rotation, scaling, transforms, and correct bounding boxes — without rewriting everything at once.

This is structured so you and your agents can execute the plan cleanly.

⸻

✅ SPEC-DRIVEN DEVELOPMENT PLAN

0. High-Level Strategy

You will: 1. Extract a minimal viable component (MVC) next to the existing code (a new component). 2. Rebuild features one spec at a time, verifying each via:
• Unit tests for geometry/math
• Integration tests for SVG transform correctness
• E2E Playwright tests for actual UI interactions 3. Continue layering functionality until:
• The bug manifests → root cause found.
• Or you reach parity with a correct implementation → bug eliminated.

This process ensures correctness and isolates regression sources.

⸻

🔷 1. Functional Requirements (Specs)

These are the expected behaviors that must be true for the editor to be considered correct.

1.1 Selection
• Single Select
• Clicking an element selects it.
• Clicking empty space clears selection.
• Clicking another element switches selection.
• Multi-Select
• Shift+click selects multiple elements.
• Drag-box selection selects all intersecting elements.
• Selection state is stored in Vue reactivity.
• Group Selection
• Selecting multiple elements creates a virtual group.
• The group exposes x, y, width, height, rotation representing union BBox.

⸻

1.2 Bounding Box
• The bounding box must:
• Represent the union of all selected elements.
• Correctly account for rotations, scales, translations, nested <g> transformations.
• Update:
• on selection change
• after transform ends
• after DOM mutation

⸻

1.3 Transformations

All transformations apply to single or multiple selected elements.

1.3.1 Translation
• Dragging moves:
• All selected elements
• Bounding box updates after drag

1.3.2 Rotation
• Rotating affects:
• All selected elements
• Rotation must occur around:
• Single-select: element center
• Multi-select: group center

1.3.3 Scaling
• Scaling via handles:
• Preserves relative positions of elements in multi-select
• Applies transform matrix correctly per element

⸻

1.4 Event Model
• pointerdown initializes transforms
• pointermove updates transforms locally (no heavy recalculation)
• pointerup triggers BBox recompute
• Transform operations do not cause jitter or bounding-box recursion

⸻

1.5 UI Controls
• Handles appear around selection:
• 8 scale handles
• 1 rotation handle
• Handles are positioned relative to bounding box
• Handles update location live during drag

⸻

🔷 2. Unit Tests (Math + Geometry)

Using Vitest

Focus: all core formulas that must be 100% correct.

2.1 CTM-based Bounding Box Conversion

Tests for:
• local → global coordinate transform
• rotation correctness
• scale correctness
• nested group transforms
• combinations of (scale ➝ rotate ➝ translate)

2.2 Union Box Calculation

Given N elements, assert:
• correct min/max X/Y
• correct width/height
• works with non-axis aligned shapes

2.3 Transform Matrix Composition

Test:
• rotation around pivot
• scale around pivot
• translation relative to parent groups

2.4 Selection Box Geometry
• correct handle placement
• handle hitboxes
• center point correctness

2.5 Drag Logic
• translation math
• delta calculation
• applying deltas across elements

⸻

🔷 3. Integration Tests (SVG DOM Tests)

These tests run in jsdom + actual SVG DOM.

3.1 Single Element BBox
• Create an SVG rect
• Apply transform
• Assert bounding box matches expected

3.2 Multi Element BBox
• Two elements at different coordinates
• Union box must match spec

3.3 Multi Element Rotation
• Rotate group 45°
• Verify global coordinates of corners
• Verify union bounding box

3.4 Nested Group Handling
• Element inside rotated <g>
• Bounding box respects parent transform

⸻

🔷 4. E2E Tests (Playwright)

Validate real user interactions.

4.1 Selection
• Click element → selected class
• Shift+click → multiple selected
• Drag-box → selects intersecting rects

4.2 Move Transform
• Drag selected element(s)
• Expect transform attribute to change
• Expect bounding box update on mouseup

4.3 Rotation
• Drag rotation handle
• Expect transform matrix rotation
• Expect bounding box adjusts after rotate

4.4 Scaling
• Drag a scale handle
• Expect width/height changes in SVG DOM

4.5 Multi-select Transform
• Select two elements
• Rotate via handle
• Assert both elements transform by correct delta
• Assert bounding box correct post transform

4.6 Undo/Redo (optional)
• Trigger undo stack
• Verify SVG state matches previous snapshot

⸻

🔷 5. Refactor & Debug Strategy

Step 1 — Create a Minimal Viable Component (MVC)

Place it inside components/debug-svg-editor/ with:
• One rectangle hardcoded
• Single select
• No bounding box logic except CTM-based implementation
• Single rotation handle

Keep extremely minimal.

⸻

Step 2 — Add Features Back One By One

Phase 1 — Basic Selection
• single select
• bounding box render
• unit tests pass

Phase 2 — Multi-Select
• shift+click multi-select
• union BBox
• tests pass

Phase 3 — Translate
• drag transforms
• recalc BBox on end
• tests green

Phase 4 — Rotation
• rotate handle
• apply CTM rotation
• correct pivot
• tests green

Phase 5 — Scaling
• scale handles
• uniform / non-uniform scaling
• tests green

Phase 6 — Drag-Select
• drag box selection
• tests green

Phase 7 — Integration with Real UI
• replace legacy editor one subsystem at a time
• keep both versions active until complete parity

⸻

Step 3 — When Bug Appears
• Immediately snapshot state of:
• selected elements
• transform matrices
• BBox points pre/post transform
• Run failing case through unit tests
• Create a new failing test to represent regression
• Fix the math, not the symptoms

⸻

🔷 6. Deliverables Checklist

Test Suites
• Math formula unit tests
• SVG DOM integration tests
• Playwright E2E test suite

Code
• Minimal viable SVG editor component
• Clean CTM-based bounding box utility
• Transform math utilities
• Group selection state model
• Handle components (rotate/resize)

CI
• Run unit tests on every commit
• Run integration tests on every commit
• Run Playwright nightly or on merge

⸻

🎯 Done.

This spec is intentionally structured so you and your agents can execute it in parallel and produce a reliable, verifiable SVG editor — one layer at a time — while trapping the original bug deterministically.

If you want, I can also generate:
• Folder structure
• Vue component scaffolding
• Example Vitest tests
• Example Playwright tests
• A timeline/roadmap for your agents

Just tell me.
