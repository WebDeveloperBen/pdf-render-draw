import { defineStore } from 'pinia'
import type { Annotation } from '~/types/annotations'

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
 */
class UpdateAnnotationCommand implements Command {
  private annotationId: string
  private oldState: Annotation
  private newUpdates: Partial<Annotation>
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(
    annotationId: string,
    oldState: Annotation,
    newUpdates: Partial<Annotation>,
    store: ReturnType<typeof useAnnotationStore>
  ) {
    this.annotationId = annotationId
    this.oldState = oldState
    this.newUpdates = newUpdates
    this.store = store
    this.description = `Update ${oldState.type}`
  }

  execute() {
    this.store.updateAnnotation(this.annotationId, this.newUpdates)
  }

  undo() {
    // Restore to old state (need to pass full annotation, not just updates)
    this.store.setAnnotations(
      this.store.annotations.map(ann =>
        ann.id === this.annotationId ? this.oldState : ann
      )
    )
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
    this.commands.forEach(cmd => cmd.execute())
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
export const useHistoryStore = defineStore('history', () => {
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

  /**
   * Execute a command and add to history
   */
  function executeCommand(command: Command) {
    command.execute()

    // Add to undo stack
    undoStack.value.push(command)

    // Clear redo stack (new action invalidates redo history)
    redoStack.value = []

    // Enforce max history size
    if (undoStack.value.length > maxHistorySize.value) {
      undoStack.value.shift() // Remove oldest
    }
  }

  /**
   * Undo the last command
   */
  function undo() {
    if (!canUndo.value) {
      console.warn('Nothing to undo')
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
      console.warn('Nothing to redo')
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
    const oldState = annotationStore.getAnnotationById(id)
    if (!oldState) {
      console.error(`Cannot update annotation ${id}: not found`)
      return
    }

    const command = new UpdateAnnotationCommand(id, oldState, updates, annotationStore)
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

    // Convenience methods
    addAnnotationWithHistory,
    updateAnnotationWithHistory,
    deleteAnnotationWithHistory,
    executeBatchCommand,

    // Export command classes for advanced usage
    AddAnnotationCommand,
    UpdateAnnotationCommand,
    DeleteAnnotationCommand,
    BatchCommand,
  }
})
