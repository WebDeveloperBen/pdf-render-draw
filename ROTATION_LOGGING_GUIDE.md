# Rotation Debugging Logs - Guide

## What We Added

### 1. GroupTransform.vue Logging
- **Selection changes:** Logs when selectedAnnotationIds changes (watch)
- **onStartDrag:** Logs mode, handle, rotation state at drag start
- **Rotation setup:** Logs center point, start angle, start vector when rotation begins
- **handleRotate:** Logs rotation calculations during drag (VERBOSE - fires on every mousemove)
- **handleEndDrag:** Logs rotation commit process
- **Annotation processing:** Logs each annotation being updated with rotation
- **Cumulative rotation update:** Logs before/after cumulative rotation values
- **Transformer bounds freeze:** Logs when bounds are frozen
- **transformerTransform computed:** Logs rotation transform calculation (VERBOSE - fires frequently)

### 2. AnnotationStore Logging
- **updateAnnotation (rotation):** Logs before/after rotation values when rotation is updated
- Logs show both radians and degrees for easier debugging

### 3. TransformBase Logging
- **createEndDragHandler:** Logs drag state before cleanup
- **cleanupState:** Logs state being cleaned up (including currentRotationDelta)

## Log Flow for Successful Rotation

Here's what a **successful** rotation should look like in the logs:

```
[1] GroupTransform: onStartDrag { mode: "rotate", handle: "rotate", ... }
[2] GroupTransform: Rotation setup { center: {...}, startAngle: 1.57... }
[3] GroupTransform: handleRotate { rotationDeltaRad: 0.1, ... }  // Many times during drag
[4] GroupTransform: transformerTransform computed { totalRotation: 0.1, ... }  // Many times
[5] TransformBase: createEndDragHandler { currentRotationDelta: 3.14... }
[6] GroupTransform: handleEndDrag called { mode: "rotate", moved: true }
[7] GroupTransform: handleEndDrag rotate commit START { deltaRad: 3.14..., deltaDeg: 180 }
[8] GroupTransform: Processing annotation 1/2 { id: "...", type: "fill", hasX: true }
[9] GroupTransform: Committing rotation for positioned annotation {
      originalRotation: 0,
      deltaRad: 3.14159,
      finalRotation: 3.14159,
      finalRotationDeg: 180
    }
[10] AnnotationStore: updateAnnotation - rotation update {
       beforeRotation: 0,
       updateRotation: 3.14159,
       updateRotationDeg: 180
     }
[11] AnnotationStore: updateAnnotation - after save {
       savedRotation: 3.14159,  // ✓ GOOD - rotation persisted
       savedRotationDeg: 180
     }
[12] GroupTransform: After update {
       rotation: 3.14159,  // ✓ GOOD - still there
       rotationDeg: 180
     }
[13] GroupTransform: Processing annotation 2/2 { ... }  // Repeat 9-12
[14] GroupTransform: Updated cumulative rotation {
       oldCumulative: 0,
       delta: 3.14159,
       newCumulative: 3.14159,  // ✓ GOOD - cumulative updated
       newCumulativeDeg: 180
     }
[15] GroupTransform: Froze transformer bounds { x: ..., y: ..., width: ..., height: ... }
[16] TransformBase: cleanupState { currentRotationDelta: 3.14159 }
[17] TransformBase: cleanupState complete
[18] GroupTransform: transformerTransform computed {
       cumulativeGroupRotation: 3.14159,  // ✓ GOOD - handles should stay rotated!
       dragDelta: 0,
       totalRotation: 3.14159
     }
```

## What to Look For (Bug Indicators)

### Indicator 1: Rotation Not Saved
```
[11] AnnotationStore: updateAnnotation - after save {
       savedRotation: 0,  // ✗ BAD - rotation lost!
       savedRotationDeg: 0
     }
```
**Cause:** Validation or recalculation logic is resetting rotation

### Indicator 2: Cumulative Rotation Reset
```
[14] GroupTransform: Updated cumulative rotation {
       newCumulative: 3.14159
     }
// ... later ...
[18] GroupTransform: Selection changed {
       resetting: { cumulativeGroupRotation: 3.14159 }  // ✗ BAD - unexpected reset!
     }
[19] GroupTransform: transformerTransform computed {
       cumulativeGroupRotation: 0,  // ✗ BAD - handles snap back!
     }
```
**Cause:** Selection change event firing when it shouldn't

### Indicator 3: Frozen Bounds Cleared
```
[15] GroupTransform: Froze transformer bounds { ... }
// ... later (without user action) ...
GroupTransform: onStartDrag { frozenTransformerBounds: null }  // ✗ BAD - bounds lost!
```
**Cause:** Bounds being cleared by selection change or other logic

### Indicator 4: Transform Cleanup Too Early
```
[16] TransformBase: cleanupState { currentRotationDelta: 3.14159 }
[17] TransformBase: cleanupState complete
// Before handleEndDrag completes!
```
**Cause:** Cleanup happening before rotation is committed

## Console Filter Commands

To focus on specific logs:
```javascript
// All rotation-related logs
/GroupTransform|AnnotationStore|TransformBase/

// Just rotation commits
/rotate commit|Committing rotation|Updated cumulative/

// Just store updates
/AnnotationStore.*rotation/

// Selection changes (potential culprit)
/Selection changed/

// Transform cleanup (potential early cleanup)
/cleanupState/
```

## Key Metrics to Track

1. **Rotation Delta:** Should be non-zero during rotation
2. **Final Rotation:** Should equal original + delta
3. **Saved Rotation:** Should match final rotation
4. **Cumulative Rotation:** Should persist after drag ends
5. **Frozen Bounds:** Should persist until next selection change

## Next Steps After Testing

1. Run the test from ROTATION_DEBUG_STEPS.md
2. Capture the console logs
3. Compare against "successful" flow above
4. Look for the bug indicators listed
5. Identify which indicator matches the actual bug
6. Fix the root cause identified
