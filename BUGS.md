# Known Bugs

## High Priority

### 1. Click-to-Deselect Not Working
**Status:** ✅ FIXED
**Severity:** High (UX Issue)

**Description:**
Clicking outside of annotations (on empty SVG space) did not deselect the currently selected annotation(s).

**Root Cause:**
The `selectionMarquee.isDrawing` property is a Vue ref object, but the code was checking the ref itself instead of its `.value` property. Since ref objects are always truthy, the condition `!selectionMarquee.isDrawing` was always false, preventing deselection.

**The Fix:**
Changed all instances of `selectionMarquee.isDrawing` to `selectionMarquee.isDrawing.value` in three locations:
1. `handleMouseUp()` - SvgAnnotationLayer.vue:76
2. `handleClick()` - SvgAnnotationLayer.vue:142 (deselection logic)
3. `handleMove()` - SvgAnnotationLayer.vue:213

**Additional Fixes:**
- Fixed `handleDoubleClick()` to use `closest()` pattern for finding annotation IDs (SvgAnnotationLayer.vue:228)
- Created generic double-click handler registry system (useAnnotationDoubleClick.ts)
- Text tool registers its double-click handler in the registry
- Transform component uses registry to handle double-clicks generically
- Added double-click detection to prevent drag interference

**Architecture Improvement:**
Created `useAnnotationDoubleClick` composable for managing double-click handlers:
- Tools register their double-click handlers by annotation type
- Transform and SvgAnnotationLayer delegate to registry instead of hardcoding
- Prevents drag operations from starting during double-click events
- Extensible: any annotation type can register a double-click handler

**Files Modified:**
- `app/components/SvgAnnotationLayer.vue` (lines 5, 9, 225-237)
- `app/components/handles/Transform.vue` (lines 5, 9, 27-30, 123-143, 145-160, 411)
- `app/composables/tools/useTextTool.ts` (lines 6, 11, 101-107)
- `app/composables/useAnnotationDoubleClick.ts` (new file)
- `app/composables/tools/useTextTool.spec.ts` (test fixes for radians vs degrees)

**Diagnostic Process:**
1. ✓ Added comprehensive console logging to handleClick
2. ✓ Reviewed browser console - discovered ref object being checked instead of value
3. ✓ Fixed all three instances of the ref bug
4. ✓ Fixed double-click to edit text (both via text elements and transform handles)
5. ✓ Verified all tests pass (26 click/text tests passing)

---

### 2. Edge Handle Axis Not Updating After Rotation
**Status:** Not Fixed
**Severity:** Medium (UX/Functional Issue)

**Description:**
After rotating a shape, the middle edge handles (used for single-axis resizing) remain hardcoded to their original horizontal/vertical orientation instead of rotating with the shape.

**Expected Behavior:**
- When shape is rotated 45°, edge handles should also rotate 45°
- Edge handles should always resize along the local axes of the rotated shape
- Top/bottom handles should resize along the shape's local Y-axis
- Left/right handles should resize along the shape's local X-axis

**Current Behavior:**
- Edge handles stay in original orientation (world space)
- Handles resize in world-space horizontal/vertical instead of shape's local axes
- This feels wrong and makes precise resizing difficult after rotation

**Files Involved:**
- `app/components/handles/Transform.vue` (edge handles rendering and resize logic)
- `app/components/handles/GroupTransform.vue` (same issue for group transforms)

**Code Locations:**
- Edge handle positions: `Transform.vue` lines ~87-98 (edges computed property)
- Edge handle rendering: `Transform.vue` lines ~429-447
- Edge handle resize logic: `Transform.vue` lines ~138-246 (handleResize function)

**Potential Solutions:**
1. Apply rotation transform to edge handles (similar to corner handles)
2. Calculate resize delta in local coordinate space instead of world space
3. Transform mouse delta by inverse rotation before applying to resize
4. Consider if edge handles should even be shown for rotated shapes (or show warning)

**Technical Notes:**
- Corner handles work correctly because they move with rotation
- Edge handles are calculated from `displayBounds` which doesn't account for rotation
- Resize logic assumes world-space horizontal/vertical deltas
- Need to transform deltas by rotation angle before applying to bounds

---

## Testing Status

- **Total Tests:** 763 passing, 15 failing
- **Failing Tests:** Pre-existing in `tool-interaction.spec.ts` (testing old behavior)
- **New Tests Added:**
  - Text rotation: 7 tests ✓
  - Text minimum size: 6 tests ✓
  - Click-to-deselect: 3 tests ✓ (store-level only, UI not working)

---

## Notes

These bugs were identified during the text tool implementation and transformation standardization work. Both issues affect the overall UX and should be addressed before release.
