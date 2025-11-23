# Rotation Debug Test Steps

## Setup
1. Run the dev server: `pnpm run dev`
2. Open browser console (F12 or Cmd+Option+I)
3. Filter console by "GroupTransform" or "AnnotationStore" to focus on rotation logs

## Test Case: Group Rotation
Follow these exact steps while watching the console:

### Step 1: Create annotations
1. Select Fill tool
2. Draw 2-3 fill shapes on the PDF

### Step 2: Select multiple annotations
1. Switch to Selection tool (or press Escape)
2. Click on first fill shape to select it
3. Hold Shift and click on second fill shape to multi-select

**Expected logs:**
- `GroupTransform: Selection changed` - showing selection IDs
- `GroupTransform: transformerTransform computed` - showing rotation values

### Step 3: Rotate the group
1. Grab the rotation handle (circular handle above the group)
2. Drag to rotate ~180 degrees
3. **While dragging**, watch for these logs:
   - `GroupTransform: handleRotate` - should show rotation delta updates
   - `GroupTransform: transformerTransform computed` - totalRotation should increase
4. Release the mouse

**Expected logs on release:**
- `TransformBase: createEndDragHandler` - showing currentRotationDelta
- `GroupTransform: handleEndDrag called` - mode should be 'rotate', moved should be true
- `GroupTransform: handleEndDrag rotate commit START` - showing delta
- `GroupTransform: Processing annotation N/N` - for each annotation
- `GroupTransform: Committing rotation for positioned annotation` - showing:
  - originalRotation (should be 0)
  - deltaRad (your rotation amount)
  - finalRotation (originalRotation + deltaRad)
- `AnnotationStore: updateAnnotation - rotation update` - showing rotation being saved
- `AnnotationStore: updateAnnotation - after save` - **CRITICAL: Check if rotation is still there!**
- `GroupTransform: After update` - **CRITICAL: Check if rotation is still there!**
- `GroupTransform: Updated cumulative rotation` - newCumulative should equal delta
- `GroupTransform: Froze transformer bounds`
- `TransformBase: cleanupState` - currentRotationDelta should be cleared

### Step 4: Check the result
1. Look at the selected annotations - do the handles stay rotated?
2. Click elsewhere to deselect
3. Re-select the group

**Expected logs on reselection:**
- `GroupTransform: Selection changed` - resetting cumulativeGroupRotation to 0
- `GroupTransform: transformerTransform computed` - showing rotation values

**BUG TO LOOK FOR:**
- If handles snap back to axis-aligned, check the logs for:
  1. Was `finalRotation` calculated correctly in "Committing rotation"?
  2. Was rotation actually saved in "after save" log?
  3. Is `cumulativeGroupRotation` being reset unexpectedly?
  4. Is there a Selection changed event that shouldn't be there?

## Expected Behavior
After rotating a group:
- The annotations should be rotated ✓
- The transform handles should stay rotated with the group ✓
- When you reselect, handles should still wrap the rotated shapes ✓

## Actual Bug Behavior
After rotating a group:
- The annotations rotate correctly ✓
- But handles snap back to axis-aligned ✗
- On reselection, handles are still axis-aligned ✗

## Key Things to Check in Logs

1. **Rotation Commit:** Is `finalRotation` being calculated correctly?
2. **Store Save:** Is the rotation actually being saved to the annotation?
3. **Cumulative Reset:** Is `cumulativeGroupRotation` being reset when it shouldn't be?
4. **Selection Events:** Are there unexpected selection change events?

## Likely Root Causes

Based on the bug description, the issue is likely one of:

1. **Rotation not persisting:** The rotation is calculated but not saved
2. **Cumulative rotation resetting:** `cumulativeGroupRotation` is being reset after commit
3. **Selection change trigger:** Something is triggering a selection change that resets state
4. **Transform bounds recalculation:** Frozen bounds are being cleared when they shouldn't be

Look for any of these patterns in the console logs!
