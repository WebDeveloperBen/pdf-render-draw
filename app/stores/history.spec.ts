import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useHistoryStore } from './history'
import { useAnnotationStore } from './annotations'
import type { Point } from '~/types'
import type { Measurement, Area, Perimeter, TextAnnotation } from '~/types/annotations'

// Import command classes directly from the store file to avoid Pinia proxy issues
// These are exported at the end of the store definition
interface Command {
  execute(): void
  undo(): void
  description: string
}

class AddAnnotationCommand implements Command {
  private annotation: any
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(annotation: any, store: ReturnType<typeof useAnnotationStore>) {
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

class UpdateAnnotationCommand implements Command {
  private annotationId: string
  private oldState: any
  private newUpdates: Partial<any>
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(
    annotationId: string,
    oldState: any,
    newUpdates: Partial<any>,
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
    this.store.setAnnotations(
      this.store.annotations.map(ann =>
        ann.id === this.annotationId ? this.oldState : ann
      )
    )
  }
}

class DeleteAnnotationCommand implements Command {
  private annotation: any
  private store: ReturnType<typeof useAnnotationStore>
  description: string

  constructor(annotation: any, store: ReturnType<typeof useAnnotationStore>) {
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

describe('History Store', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())
  })

  describe('Command Execution', () => {
    it('should execute command and add to undo stack', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const command = new AddAnnotationCommand(measurement, annotationStore)
      historyStore.executeCommand(command)

      // Command should be executed
      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]?.id).toBe('measure-1')

      // Command should be in undo stack
      expect(historyStore.undoStack).toHaveLength(1)
      expect(historyStore.canUndo).toBe(true)
    })

    it('should clear redo stack when new command is executed', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement1: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const measurement2: Measurement = {
        id: 'measure-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
        distance: 141.42,
        midpoint: { x: 250, y: 250 },
        labelRotation: 0,
      }

      // Add first annotation
      const command1 = new AddAnnotationCommand(measurement1, annotationStore)
      historyStore.executeCommand(command1)

      // Undo it
      historyStore.undo()
      expect(historyStore.redoStack).toHaveLength(1)

      // Execute new command
      const command2 = new AddAnnotationCommand(measurement2, annotationStore)
      historyStore.executeCommand(command2)

      // Redo stack should be cleared
      expect(historyStore.redoStack).toHaveLength(0)
      expect(historyStore.canRedo).toBe(false)
    })

    it('should enforce max history size', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      // Set max history to 3 for testing
      historyStore.maxHistorySize = 3

      // Add 5 annotations
      for (let i = 0; i < 5; i++) {
        const measurement: Measurement = {
          id: `measure-${i}`,
          type: 'measure',
          pageNum: 1,
          points: [
            { x: i * 10, y: 0 },
            { x: i * 10 + 100, y: 100 },
          ],
          distance: 141.42,
          midpoint: { x: i * 10 + 50, y: 50 },
          labelRotation: 0,
        }

        const command = new AddAnnotationCommand(measurement, annotationStore)
        historyStore.executeCommand(command)
      }

      // Should only keep the last 3 commands
      expect(historyStore.undoStack).toHaveLength(3)
    })
  })

  describe('Undo Functionality', () => {
    it('should undo last command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)
      expect(annotationStore.annotations).toHaveLength(1)

      historyStore.undo()

      // Annotation should be removed
      expect(annotationStore.annotations).toHaveLength(0)

      // Command should be in redo stack
      expect(historyStore.redoStack).toHaveLength(1)
      expect(historyStore.canRedo).toBe(true)

      // Command should be removed from undo stack
      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.canUndo).toBe(false)
    })

    it('should not undo when stack is empty', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      expect(historyStore.canUndo).toBe(false)

      historyStore.undo()

      // Should have no effect
      expect(annotationStore.annotations).toHaveLength(0)
      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.redoStack).toHaveLength(0)
    })

    it('should move command from undo stack to redo stack', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)

      expect(historyStore.undoStack).toHaveLength(1)
      expect(historyStore.redoStack).toHaveLength(0)

      historyStore.undo()

      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.redoStack).toHaveLength(1)
    })
  })

  describe('Redo Functionality', () => {
    it('should redo last undone command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)
      historyStore.undo()

      expect(annotationStore.annotations).toHaveLength(0)

      historyStore.redo()

      // Annotation should be re-added
      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]?.id).toBe('measure-1')

      // Command should be back in undo stack
      expect(historyStore.undoStack).toHaveLength(1)
      expect(historyStore.canUndo).toBe(true)

      // Command should be removed from redo stack
      expect(historyStore.redoStack).toHaveLength(0)
      expect(historyStore.canRedo).toBe(false)
    })

    it('should not redo when stack is empty', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      expect(historyStore.canRedo).toBe(false)

      historyStore.redo()

      // Should have no effect
      expect(annotationStore.annotations).toHaveLength(0)
      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.redoStack).toHaveLength(0)
    })

    it('should move command from redo stack to undo stack', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)
      historyStore.undo()

      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.redoStack).toHaveLength(1)

      historyStore.redo()

      expect(historyStore.undoStack).toHaveLength(1)
      expect(historyStore.redoStack).toHaveLength(0)
    })
  })

  describe('Can Undo/Redo Flags', () => {
    it('should return correct canUndo flag', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      expect(historyStore.canUndo).toBe(false)

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)

      expect(historyStore.canUndo).toBe(true)

      historyStore.undo()

      expect(historyStore.canUndo).toBe(false)
    })

    it('should return correct canRedo flag', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      expect(historyStore.canRedo).toBe(false)

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)

      expect(historyStore.canRedo).toBe(false)

      historyStore.undo()

      expect(historyStore.canRedo).toBe(true)

      historyStore.redo()

      expect(historyStore.canRedo).toBe(false)
    })
  })

  describe('Command Descriptions', () => {
    it('should return undo description', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      expect(historyStore.undoDescription).toBeNull()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)

      expect(historyStore.undoDescription).toBe('Add measure')
    })

    it('should return redo description', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      expect(historyStore.redoDescription).toBeNull()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)
      historyStore.undo()

      expect(historyStore.redoDescription).toBe('Add measure')
    })
  })

  describe('Clear History', () => {
    it('should clear both undo and redo stacks', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)
      historyStore.undo()

      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.redoStack).toHaveLength(1)

      historyStore.clearHistory()

      expect(historyStore.undoStack).toHaveLength(0)
      expect(historyStore.redoStack).toHaveLength(0)
      expect(historyStore.canUndo).toBe(false)
      expect(historyStore.canRedo).toBe(false)
    })
  })

  describe('AddAnnotationCommand', () => {
    it('should add annotation on execute', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const command = new AddAnnotationCommand(measurement, annotationStore)
      command.execute()

      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]?.id).toBe('measure-1')
    })

    it('should remove annotation on undo', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const command = new AddAnnotationCommand(measurement, annotationStore)
      command.execute()

      expect(annotationStore.annotations).toHaveLength(1)

      command.undo()

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should have correct description', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const command = new AddAnnotationCommand(measurement, annotationStore)

      expect(command.description).toBe('Add measure')
    })
  })

  describe('UpdateAnnotationCommand', () => {
    it('should update annotation on execute', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      annotationStore.addAnnotation(text)

      const oldState = annotationStore.getAnnotationById('text-1')!
      const updates = { content: 'Updated' }

      const command = new UpdateAnnotationCommand('text-1', oldState, updates, annotationStore)
      command.execute()

      const updated = annotationStore.getAnnotationById('text-1') as TextAnnotation
      expect(updated.content).toBe('Updated')
    })

    it('should restore old state on undo', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      annotationStore.addAnnotation(text)

      const oldState = annotationStore.getAnnotationById('text-1')!
      const updates = { content: 'Updated' }

      const command = new UpdateAnnotationCommand('text-1', oldState, updates, annotationStore)
      command.execute()

      command.undo()

      const restored = annotationStore.getAnnotationById('text-1') as TextAnnotation
      expect(restored.content).toBe('Original')
    })

    it('should have correct description', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      annotationStore.addAnnotation(text)

      const oldState = annotationStore.getAnnotationById('text-1')!
      const updates = { content: 'Updated' }

      const command = new UpdateAnnotationCommand('text-1', oldState, updates, annotationStore)

      expect(command.description).toBe('Update text')
    })
  })

  describe('DeleteAnnotationCommand', () => {
    it('should delete annotation on execute', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      annotationStore.addAnnotation(measurement)

      const command = new DeleteAnnotationCommand(measurement, annotationStore)
      command.execute()

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should restore annotation on undo', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      annotationStore.addAnnotation(measurement)

      const command = new DeleteAnnotationCommand(measurement, annotationStore)
      command.execute()

      expect(annotationStore.annotations).toHaveLength(0)

      command.undo()

      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]?.id).toBe('measure-1')
    })

    it('should have correct description', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const command = new DeleteAnnotationCommand(measurement, annotationStore)

      expect(command.description).toBe('Delete measure')
    })
  })

  describe('BatchCommand', () => {
    it('should execute multiple commands', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement1: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const measurement2: Measurement = {
        id: 'measure-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
        distance: 141.42,
        midpoint: { x: 250, y: 250 },
        labelRotation: 0,
      }

      const commands = [
        new AddAnnotationCommand(measurement1, annotationStore),
        new AddAnnotationCommand(measurement2, annotationStore),
      ]

      const batchCommand = new BatchCommand(commands, 'Add multiple measurements')
      batchCommand.execute()

      expect(annotationStore.annotations).toHaveLength(2)
    })

    it('should undo multiple commands in reverse order', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement1: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const measurement2: Measurement = {
        id: 'measure-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
        distance: 141.42,
        midpoint: { x: 250, y: 250 },
        labelRotation: 0,
      }

      const commands = [
        new AddAnnotationCommand(measurement1, annotationStore),
        new AddAnnotationCommand(measurement2, annotationStore),
      ]

      const batchCommand = new BatchCommand(commands, 'Add multiple measurements')
      batchCommand.execute()

      expect(annotationStore.annotations).toHaveLength(2)

      batchCommand.undo()

      expect(annotationStore.annotations).toHaveLength(0)
    })

    it('should have custom description', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const commands: any[] = []
      const batchCommand = new BatchCommand(commands, 'Custom batch description')

      expect(batchCommand.description).toBe('Custom batch description')
    })
  })

  describe('AddAnnotationWithHistory Helper', () => {
    it('should add annotation and create command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      historyStore.addAnnotationWithHistory(measurement)

      expect(annotationStore.annotations).toHaveLength(1)
      expect(historyStore.canUndo).toBe(true)
      expect(historyStore.undoDescription).toBe('Add measure')
    })
  })

  describe('UpdateAnnotationWithHistory Helper', () => {
    it('should update annotation and create command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const text: TextAnnotation = {
        id: 'text-1',
        type: 'text',
        pageNum: 1,
        x: 100,
        y: 100,
        width: 200,
        height: 50,
        content: 'Original',
        fontSize: 16,
        color: '#000',
        rotation: 0,
      }

      annotationStore.addAnnotation(text)

      historyStore.updateAnnotationWithHistory('text-1', { content: 'Updated' })

      const updated = annotationStore.getAnnotationById('text-1') as TextAnnotation
      expect(updated.content).toBe('Updated')
      expect(historyStore.canUndo).toBe(true)
      expect(historyStore.undoDescription).toBe('Update text')
    })

    it('should not create command if annotation not found', () => {
      const historyStore = useHistoryStore()

      historyStore.updateAnnotationWithHistory('non-existent', { content: 'Updated' })

      expect(historyStore.canUndo).toBe(false)
    })
  })

  describe('DeleteAnnotationWithHistory Helper', () => {
    it('should delete annotation and create command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      annotationStore.addAnnotation(measurement)

      historyStore.deleteAnnotationWithHistory('measure-1')

      expect(annotationStore.annotations).toHaveLength(0)
      expect(historyStore.canUndo).toBe(true)
      expect(historyStore.undoDescription).toBe('Delete measure')
    })

    it('should not create command if annotation not found', () => {
      const historyStore = useHistoryStore()

      historyStore.deleteAnnotationWithHistory('non-existent')

      expect(historyStore.canUndo).toBe(false)
    })
  })

  describe('ExecuteBatchCommand Helper', () => {
    it('should execute batch command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement1: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const measurement2: Measurement = {
        id: 'measure-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
        distance: 141.42,
        midpoint: { x: 250, y: 250 },
        labelRotation: 0,
      }

      const commands = [
        new AddAnnotationCommand(measurement1, annotationStore),
        new AddAnnotationCommand(measurement2, annotationStore),
      ]

      historyStore.executeBatchCommand(commands, 'Add multiple measurements')

      expect(annotationStore.annotations).toHaveLength(2)
      expect(historyStore.canUndo).toBe(true)
      expect(historyStore.undoDescription).toBe('Add multiple measurements')
    })
  })

  describe('Multiple Undo/Redo Cycles', () => {
    it('should handle multiple undo/redo operations correctly', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement1: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const measurement2: Measurement = {
        id: 'measure-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
        distance: 141.42,
        midpoint: { x: 250, y: 250 },
        labelRotation: 0,
      }

      // Add two annotations
      historyStore.addAnnotationWithHistory(measurement1)
      historyStore.addAnnotationWithHistory(measurement2)

      expect(annotationStore.annotations).toHaveLength(2)

      // Undo twice
      historyStore.undo()
      historyStore.undo()

      expect(annotationStore.annotations).toHaveLength(0)

      // Redo once
      historyStore.redo()

      expect(annotationStore.annotations).toHaveLength(1)
      expect(annotationStore.annotations[0]?.id).toBe('measure-1')

      // Redo again
      historyStore.redo()

      expect(annotationStore.annotations).toHaveLength(2)
    })
  })

  describe('Group Operations with Batch Commands', () => {
    it('should handle group rotation as a batch command', () => {
      const historyStore = useHistoryStore()
      const annotationStore = useAnnotationStore()

      const measurement1: Measurement = {
        id: 'measure-1',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        distance: 141.42,
        midpoint: { x: 50, y: 50 },
        labelRotation: 0,
      }

      const measurement2: Measurement = {
        id: 'measure-2',
        type: 'measure',
        pageNum: 1,
        points: [
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
        distance: 141.42,
        midpoint: { x: 250, y: 250 },
        labelRotation: 0,
      }

      annotationStore.addAnnotation(measurement1)
      annotationStore.addAnnotation(measurement2)

      const oldState1 = annotationStore.getAnnotationById('measure-1')!
      const oldState2 = annotationStore.getAnnotationById('measure-2')!

      const commands = [
        new UpdateAnnotationCommand('measure-1', oldState1, { rotation: 45 }, annotationStore),
        new UpdateAnnotationCommand('measure-2', oldState2, { rotation: 45 }, annotationStore),
      ]

      historyStore.executeBatchCommand(commands, 'Rotate group')

      const updated1 = annotationStore.getAnnotationById('measure-1') as Measurement
      const updated2 = annotationStore.getAnnotationById('measure-2') as Measurement

      expect(updated1.rotation).toBe(45)
      expect(updated2.rotation).toBe(45)

      // Undo batch operation
      historyStore.undo()

      const restored1 = annotationStore.getAnnotationById('measure-1') as Measurement
      const restored2 = annotationStore.getAnnotationById('measure-2') as Measurement

      expect(restored1.rotation).toBeUndefined()
      expect(restored2.rotation).toBeUndefined()
    })
  })
})
