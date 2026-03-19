/**
 * Tool Registry - Plugin system for annotation tools
 *
 * Tools register themselves here with their component and configuration.
 * AnnotationLayer automatically discovers and renders all registered tools.
 *
 * Note: Transformation logic is handled generically by useTransformBase and
 * data-structure type guards (hasPointsArray, hasPositionedRect) rather than
 * tool-specific configuration. This keeps tools decoupled from transform logic.
 */

import { Rotate3d } from "lucide-vue-next"
import type { Component } from "vue"

export interface ToolDefinition {
  /** Unique tool type identifier */
  type: ToolType

  /** Vue component that renders the tool's annotations (optional for direct rendering) */
  component?: Component

  /** Display name for the toolbar */
  name: string

  /** Toolbar icon (lucide-vue-next component) */
  icon: Component

  /** Optional: Handler for double-click events on this tool's annotations */
  onDoubleClick?: (annotationId: string) => void

  /** Optional: Handler for context menu events */
  onContextMenu?: (annotationId: string) => void

  /** Optional: Event handlers for SVG layer events */
  onClick?: (event: EditorInputEvent) => void
  onMouseDown?: (event: EditorInputEvent) => void
  onMouseUp?: (event: EditorInputEvent) => void
  onMouseMove?: (event: EditorInputEvent) => void
  onMouseLeave?: (event: EditorInputEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void

  /** Optional: Method to clear preview state when mouse leaves */
  clearPreview?: () => void

  /** Optional: Get minimum dimensions for scaling constraints */
  getMinDimensions?: (annotation: Annotation) => { width: number; height: number }
}

// Tool registry - use ref with markRaw to avoid deep reactivity on components
// while still allowing mutations to trigger updates
const toolRegistry = ref(markRaw(new Map<ToolType, ToolDefinition>()))

/**
 * Register a tool in the system
 * Call this in your tool's module to make it available
 */
export function registerTool(definition: ToolDefinition) {
  // Skip if already registered — prevents SSR export from overwriting
  // the editor's live handlers with dead SSR-context references.
  if (toolRegistry.value.has(definition.type)) return

  toolRegistry.value.set(definition.type, definition)
  // Trigger reactivity update since the Map is marked raw
  triggerRef(toolRegistry)
}

/**
 * Unregister a tool
 */
export function unregisterTool(type: ToolType) {
  toolRegistry.value.delete(type)
  // Trigger reactivity update since the Map is marked raw
  triggerRef(toolRegistry)
}

/**
 * Get a specific tool definition
 */
export function getTool(type: ToolType): ToolDefinition | undefined {
  return toolRegistry.value.get(type)
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.value.values())
}

/**
 * Get toolbar-ready tool definitions
 */
export function getToolbarTools() {
  return getAllTools().map((tool) => ({
    id: tool.type,
    name: tool.name,
    icon: tool.icon
  }))
}

/**
 * Get complete toolbar tools including manual tools (rotate, etc.)
 */
export function getCompleteToolbarTools() {
  const registeredTools = getToolbarTools()
  const manualTools: Array<{ id: ToolType | "selection" | "rotate" | ""; name: string; icon: Component }> = [
    { id: "rotate", name: "Rotate", icon: Rotate3d }
  ]
  return [...registeredTools, ...manualTools]
}

/**
 * Clear all registered tools.
 * Called when the AnnotationLayer unmounts so that on the next mount
 * tools re-register with fresh handler closures instead of being
 * skipped by the duplicate-registration guard.
 */
export function clearRegistry() {
  toolRegistry.value.clear()
  triggerRef(toolRegistry)
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(type: ToolType): boolean {
  return toolRegistry.value.has(type)
}

/**
 * Composable to use the tool registry in components
 */
export function useToolRegistry() {
  return {
    registerTool,
    unregisterTool,
    clearRegistry,
    getTool,
    getAllTools,
    getToolbarTools,
    getCompleteToolbarTools,
    isToolRegistered
  }
}
