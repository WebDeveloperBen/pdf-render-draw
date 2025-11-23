# Bugs to Fix

## 1. Transform Handles Don't Reset on Reselection

**Status:** investigating

**Description:**
When you rotate a shape using the transform handles, the handles rotate with the shape instead of staying axis-aligned.

**Steps to reproduce:**

1. Select an annotation (e.g., fill shape)
2. Drag the rotation handle to rotate it ~180 degrees
3. **Expected:** Transform handles (corners, edges, rotation handle) stay axis-aligned while the selection outline shows the rotation
4. **Actual:** Transform handles rotate with the shape

**Root cause:**
The transform handles group inherits the annotation's rotation transform from BaseAnnotation parent. We need to apply counter-rotation to the handles group to keep them axis-aligned.

**Current issue:**
- Rotation is being committed (stored in annotation.rotation)
- Counter-rotation transform is being calculated correctly (negative angle)
- But something is resetting the rotation to 0 after drag ends

