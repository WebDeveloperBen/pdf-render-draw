# Copy, Paste & Undo Feature

## Current State

###  Already Implemented

#### Undo/Redo System (`stores/history.ts`)
- **Command Pattern** with dedicated command classes:
  - `AddAnnotationCommand`
  - `UpdateAnnotationCommand`
  - `DeleteAnnotationCommand`
  - `BatchCommand` (for multi-annotation operations)
- Undo/Redo stacks with configurable max history size (default: 100)
- Convenience methods: `addAnnotationWithHistory()`, `updateAnnotationWithHistory()`, `deleteAnnotationWithHistory()`

#### Keyboard Shortcuts (`composables/useKeyboardShortcuts.ts`)
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + Y` | Redo (alternate) |
| `Cmd/Ctrl + C` | Copy |
| `Cmd/Ctrl + V` | Paste |
| `Cmd/Ctrl + D` | Duplicate |
| `Delete / Backspace` | Delete selected |
| `Escape` | Deselect |

#### Copy/Paste
- In-memory clipboard (single annotation)
- Paste at cursor position OR with 20px offset
- Creates new ID on paste
- Uses `offsetAnnotation()` helper for position adjustment

---

## Gaps & Improvements Needed

### 1. Multi-Select Copy/Paste
**Current:** Only copies single selected annotation
**Needed:** Copy/paste multiple selected annotations as a group

```typescript
// Current - single annotation
clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotation))

// Needed - multiple annotations
clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotations))
```

**Tasks:**
- [ ] Update clipboard type to `Annotation[]`
- [ ] Update copy handler to use `selectedAnnotations`
- [ ] Update paste to create multiple annotations with relative positions preserved
- [ ] Paste should select all newly created annotations

### 2. Cut Operation
**Current:** Not implemented
**Needed:** `Cmd/Ctrl + X` to cut (copy + delete)

```typescript
{
  key: "x",
  ctrl: !isMac.value,
  meta: isMac.value,
  handler: (e) => {
    if (annotationStore.selectedAnnotations.length > 0) {
      e.preventDefault()
      // Copy to clipboard
      clipboard.value = JSON.parse(JSON.stringify(annotationStore.selectedAnnotations))
      // Delete originals (with history)
      annotationStore.selectedAnnotations.forEach(ann => {
        historyStore.deleteAnnotationWithHistory(ann.id)
      })
    }
  },
  description: "Cut"
}
```

### 3. Cross-Page Paste
**Current:** Pastes to same page as original
**Needed:** Paste to current active page

```typescript
// When pasting, override pageNum to current page
const newAnnotation = {
  ...offsetAnnotation(original, offsetX, offsetY),
  id: crypto.randomUUID(),
  pageNum: rendererStore.currentPage  // <-- Paste to current page
}
```

### 4. History Integration Audit
**Issue:** Not all operations go through history store

**Needs audit:**
- [ ] Tool creation (measure, area, etc.) - should use `addAnnotationWithHistory`
- [ ] Transform operations (move, resize, rotate) - verify using `updateAnnotationWithHistory`
- [ ] Multi-select transforms - verify using `BatchCommand`

### 5. Visual Feedback
**Current:** Console.log only
**Needed:** Toast notifications for user feedback

```typescript
// After copy
toast.success('Copied to clipboard')

// After paste
toast.success('Pasted annotation')

// After undo/redo
toast.info(`Undo: ${historyStore.undoDescription}`)
```

### 6. Undo/Redo UI Indicators
**Needed:** Visual indicators showing undo/redo availability

- Toolbar buttons for Undo/Redo
- Disabled state when stack is empty
- Tooltip showing action description (e.g., "Undo: Delete fill")

---

## Implementation Plan

### Phase 1: Multi-Select Copy/Paste
1. Change clipboard type from `Annotation | null` to `Annotation[]`
2. Update copy handler to copy all selected annotations
3. Update paste handler to:
   - Calculate group bounding box
   - Preserve relative positions within group
   - Generate new IDs for all
   - Select all new annotations after paste
4. Update duplicate to work with multi-select

### Phase 2: Cut & Cross-Page
1. Add cut shortcut (`Cmd/Ctrl + X`)
2. Add option to paste to current page vs original page
3. Consider: paste in place vs paste at cursor

### Phase 3: History Audit
1. Audit all tool composables for history integration
2. Ensure transforms use history
3. Add BatchCommand where needed for multi-select ops

### Phase 4: UX Polish
1. Add toast notifications
2. Add toolbar undo/redo buttons
3. Add keyboard shortcut hints in UI

---

## Technical Notes

### Clipboard Structure (Multi-Select)
```typescript
interface ClipboardData {
  annotations: Annotation[]
  groupCenter: Point  // For relative positioning on paste
  sourcePage: number  // Original page number
}
```

### Paste Positioning Strategy
1. **At cursor:** Calculate offset from group center to cursor
2. **Default offset:** +20px, +20px from original positions
3. **Cross-page:** Same relative positions, different page

### History Command for Multi-Paste
```typescript
// Use BatchCommand for pasting multiple annotations
const commands = newAnnotations.map(ann =>
  new AddAnnotationCommand(ann, annotationStore)
)
historyStore.executeBatchCommand(commands, `Paste ${commands.length} annotations`)
```
