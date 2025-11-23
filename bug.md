# Bugs to Fix

## 1. Transform Handles Don't Reset on Reselection

**Status:** ✅ FIXED

**Description:**
When you rotate a shape using the transform handles, the handles rotate with the shape instead of staying axis-aligned.

**Steps to reproduce:**

1. Select multiple annotations (e.g., 2+ fill shapes)
2. Drag the rotation handle to rotate the group ~180 degrees
3. **Expected:** Transform handles (corners, edges, rotation handle) stay axis-aligned while the selection outline shows the rotation
4. **Actual:** Transform handles rotate with the shape

**Root cause:**
The `transformerTransform` was being applied to the entire handles group, rotating both the selection outline AND the handles themselves. The handles should stay axis-aligned.

**Solution implemented:**
1. Renamed `transformerTransform` to `selectionOutlineTransform` for clarity
2. Created new `handlesCounterRotation` computed that applies NEGATIVE rotation
3. Restructured template:
   - Outer group: applies `selectionOutlineTransform` (rotates everything)
   - Selection outline: renders rotated
   - Inner group: applies `handlesCounterRotation` (cancels rotation)
   - Handles: render axis-aligned at rotated positions

This creates a "rotate then counter-rotate" effect where:
- The outline shows the rotation
- The handles are positioned at the rotated corners
- But the handles themselves stay axis-aligned (not visually rotated)

**Files changed:**
- `app/components/handles/GroupTransform.vue`: Added counter-rotation logic and restructured template

**Testing:**
1. Select 2+ fill shapes
2. Rotate them using the rotation handle
3. Handles should stay axis-aligned (squares, not diamonds)
4. Selection outline should show the rotation
5. Release and re-select - handles should still be axis-aligned

