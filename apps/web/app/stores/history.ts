import { defineStore } from "pinia"

/**
 * Command Pattern for Undo/Redo
 *
 * Each annotation change creates a Command object with:
 * - execute(): Apply the change
 * - undo(): Reverse the change
 */
interface Command {
  execute(): void
  undo(): void
  description: string // For debugging/history UI
}

interface ExecutedAnnotationChange {
  before: Annotation
  after: Annotation
}

/**
 * Add Annotation Command
 */
class AddAnnotationCommand implements Command {
  private annotation: Annotation
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(annotation: Annotation, store: ReturnType<typeof useAnnotationStore>) {
    this.annotation = annotation
    this.store = store
    this.description = `Add ${annotation.type}`
  }

  execute() {
    this.store.addAnnotation(this.annotation)
  }

  undo() {
    this.store.deleteAnnotation(this.annotation.id)
  }
}

/**
 * Update Annotation Command
 *
 * Stores only the changed fields (partial diffs) rather than full annotation
 * clones. Both undo and redo apply via updateAnnotation() merge.
 */
class UpdateAnnotationCommand implements Command {
  private annotationId: string
  private oldValues: Partial<Annotation>
  private newValues: Partial<Annotation>
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(
    annotationId: string,
    oldValues: Partial<Annotation>,
    newValues: Partial<Annotation>,
    store: ReturnType<typeof useAnnotationStore>,
    annotationType: string
  ) {
    this.annotationId = annotationId
    this.oldValues = oldValues
    this.newValues = newValues
    this.store = store
    this.description = `Update ${annotationType}`
  }

  execute() {
    this.store.updateAnnotation(this.annotationId, this.newValues)
  }

  undo() {
    this.store.updateAnnotation(this.annotationId, this.oldValues)
  }
}

/**
 * Delete Annotation Command
 */
class DeleteAnnotationCommand implements Command {
  private annotation: Annotation
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(annotation: Annotation, store: ReturnType<typeof useAnnotationStore>) {
    this.annotation = annotation
    this.store = store
    this.description = `Delete ${annotation.type}`
  }

  execute() {
    this.store.deleteAnnotation(this.annotation.id)
  }

  undo() {
    this.store.addAnnotation(this.annotation)
  }
}

/**
 * Batch Command - Execute multiple commands as one
 * Used for multi-select operations or complex transactions
 */
class BatchCommand implements Command {
  private commands: Command[]
  description: string

  constructor(commands: Command[], description: string) {
    this.commands = commands
    this.description = description
  }

  execute() {
    this.commands.forEach((cmd) => cmd.execute())
  }

  undo() {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i]!.undo()
    }
  }
}

/**
 * History Store - Manages undo/redo stack
 */
export const useHistoryStore = defineStore("history", () => {
  const annotationStore = useAnnotationStore()

  // ============================================
  // State
  // ============================================

  const undoStack = ref<Command[]>([])
  const redoStack = ref<Command[]>([])
  const maxHistorySize = ref(100) // Prevent memory bloat

  // ============================================
  // Getters
  // ============================================

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  const undoDescription = computed(() => {
    const cmd = undoStack.value[undoStack.value.length - 1]
    return cmd ? cmd.description : null
  })

  const redoDescription = computed(() => {
    const cmd = redoStack.value[redoStack.value.length - 1]
    return cmd ? cmd.description : null
  })

  // ============================================
  // Actions
  // ============================================

  function pushCommand(command: Command) {
    undoStack.value.push(command)
    redoStack.value = []

    if (undoStack.value.length > maxHistorySize.value) {
      undoStack.value.shift()
    }
  }

  /**
   * Execute a command and add to history
   */
  function executeCommand(command: Command) {
    command.execute()
    pushCommand(command)
  }

  /**
   * Record a command that has already been applied outside the history store.
   * Used by drag/rotate/scale interactions that preview state live and commit on mouseup.
   */
  function recordExecutedCommand(command: Command) {
    pushCommand(command)
  }

  /**
   * Undo the last command
   */
  function undo() {
    if (!canUndo.value) {
      console.warn("Nothing to undo")
      return
    }

    const command = undoStack.value.pop()!
    command.undo()
    redoStack.value.push(command)
  }

  /**
   * Redo the last undone command
   */
  function redo() {
    if (!canRedo.value) {
      console.warn("Nothing to redo")
      return
    }

    const command = redoStack.value.pop()!
    command.execute()
    undoStack.value.push(command)
  }

  /**
   * Clear all history
   */
  function clearHistory() {
    undoStack.value = []
    redoStack.value = []
  }

  // ============================================
  // Command Factories - Convenience methods
  // ============================================

  /**
   * Create and execute an Add command
   */
  function addAnnotationWithHistory(annotation: Annotation) {
    const command = new AddAnnotationCommand(annotation, annotationStore)
    executeCommand(command)
  }

  /**
   * Create and execute an Update command
   */
  function updateAnnotationWithHistory(id: string, updates: Partial<Annotation>) {
    const current = annotationStore.getAnnotationById(id)
    if (!current) {
      console.error(`Cannot update annotation ${id}: not found`)
      return
    }

    // Build old values for only the keys being changed — clone arrays to snapshot them
    const oldValues: Partial<Annotation> = {}
    for (const key of Object.keys(updates) as (keyof Annotation)[]) {
      const val = (current as any)[key]
      ;(oldValues as any)[key] = Array.isArray(val) ? structuredClone(toRaw(val)) : val
    }

    const command = new UpdateAnnotationCommand(id, oldValues, updates, annotationStore, current.type)
    executeCommand(command)
  }

  /**
   * Create and execute a Delete command
   */
  function deleteAnnotationWithHistory(id: string) {
    const annotation = annotationStore.getAnnotationById(id)
    if (!annotation) {
      console.error(`Cannot delete annotation ${id}: not found`)
      return
    }

    const command = new DeleteAnnotationCommand(annotation, annotationStore)
    executeCommand(command)
  }

  /**
   * Create and execute a Batch command
   */
  function executeBatchCommand(commands: Command[], description: string) {
    const batchCommand = new BatchCommand(commands, description)
    executeCommand(batchCommand)
  }

  /**
   * Record a batch of already-applied annotation changes as a single undo step.
   */
  function recordExecutedBatchUpdate(changes: ExecutedAnnotationChange[], description: string) {
    // Mutable fields that can change during drag/rotate/scale
    const mutableKeys = ["x", "y", "width", "height", "rotation", "points"] as const

    const commands = changes
      .filter(({ before, after }) => {
        if (before === after) return false
        return (
          before.rotation !== after.rotation ||
          ("x" in before && "x" in after && (before.x !== after.x || before.y !== after.y)) ||
          ("width" in before && "width" in after && (before.width !== after.width || before.height !== after.height)) ||
          ("points" in before && "points" in after && before.points !== after.points)
        )
      })
      .map(({ before, after }) => {
        // Build minimal diffs — only clone fields that actually changed
        const oldValues: Record<string, unknown> = {}
        const newValues: Record<string, unknown> = {}

        for (const key of mutableKeys) {
          if (!(key in before) || !(key in after)) continue
          const bVal = (before as any)[key]
          const aVal = (after as any)[key]
          if (bVal !== aVal) {
            // Deep-clone arrays (points), shallow-copy primitives
            oldValues[key] = Array.isArray(bVal) ? structuredClone(toRaw(bVal)) : bVal
            newValues[key] = Array.isArray(aVal) ? structuredClone(toRaw(aVal)) : aVal
          }
        }

        return new UpdateAnnotationCommand(
          before.id,
          oldValues as Partial<Annotation>,
          newValues as Partial<Annotation>,
          annotationStore,
          before.type
        )
      })

    if (commands.length === 0) return

    recordExecutedCommand(new BatchCommand(commands, description))
  }

  return {
    // State
    undoStack,
    redoStack,
    maxHistorySize,

    // Getters
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,

    // Actions
    executeCommand,
    undo,
    redo,
    clearHistory,
    recordExecutedCommand,

    // Convenience methods
    addAnnotationWithHistory,
    updateAnnotationWithHistory,
    deleteAnnotationWithHistory,
    executeBatchCommand,
    recordExecutedBatchUpdate,

    // Export command classes for advanced usage
    AddAnnotationCommand,
    UpdateAnnotationCommand,
    DeleteAnnotationCommand,
    BatchCommand
  }
})
