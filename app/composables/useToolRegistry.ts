/**
 * Tool Registry - Plugin system for annotation tools
 *
 * Tools register themselves here with their component and configuration.
 * SvgAnnotationLayer automatically discovers and renders all registered tools.
 */

import type { Component } from "vue"

// Extract the type discriminator from the Annotation union
type AnnotationType = Annotation["type"]

export interface ToolDefinition {
  /** Unique tool type identifier */
  type: AnnotationType

  /** Vue component that renders the tool's annotations */
  component?: Component

  /** Display name for the toolbar */
  name: string

  /** Toolbar icon (emoji or text) */
  icon: string

  /** Optional: Handler for double-click events on this tool's annotations */
  onDoubleClick?: (annotationId: string) => void

  /** Optional: Handler for context menu events */
  onContextMenu?: (annotationId: string) => void

  /** Optional: Event handlers for SVG layer events */
  onClick?: (event: MouseEvent) => void
  onMouseDown?: (event: MouseEvent) => void
  onMouseUp?: (event: MouseEvent) => void
  onMouseMove?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
  onKeyDown?: (event: KeyboardEvent) => void

  /** Optional: Method to clear preview state when mouse leaves */
  clearPreview?: () => void
}

// Tool registry - use shallowRef to avoid making components reactive
// Components should not be made reactive for performance reasons
const toolRegistry = shallowRef(new Map<AnnotationType, ToolDefinition>())

/**
 * Register a tool in the system
 * Call this in your tool's module to make it available
 */
export function registerTool(definition: ToolDefinition) {
  console.log('[ToolRegistry] Registering tool:', definition.type, 'hasComponent:', !!definition.component, 'component:', definition.component)

  if (toolRegistry.value.has(definition.type)) {
    console.warn(`Tool "${definition.type}" is already registered. Overwriting.`)
  }

  toolRegistry.value.set(definition.type, definition)

  // Trigger reactivity update by creating new Map reference
  toolRegistry.value = new Map(toolRegistry.value)
}

/**
 * Unregister a tool (useful for testing or dynamic tool loading)
 */
export function unregisterTool(type: AnnotationType) {
  toolRegistry.value.delete(type)
}

/**
 * Get a specific tool definition
 */
export function getTool(type: AnnotationType): ToolDefinition | undefined {
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
  return getAllTools().map(tool => ({
    id: tool.type,
    name: tool.name,
    icon: tool.icon
  }))
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(type: AnnotationType): boolean {
  return toolRegistry.value.has(type)
}

/**
 * Composable to use the tool registry in components
 */
export function useToolRegistry() {
  return {
    registerTool,
    unregisterTool,
    getTool,
    getAllTools,
    getToolbarTools,
    isToolRegistered
  }
}
