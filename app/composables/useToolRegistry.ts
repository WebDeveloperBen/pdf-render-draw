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

  /** Optional: Custom event handlers */
  eventHandlers?: Record<string, (annotationId: string, event: Event) => void>
}

// Tool registry - reactive singleton storage
const toolRegistry = ref(new Map<AnnotationType, ToolDefinition>())

/**
 * Register a tool in the system
 * Call this in your tool's module to make it available
 */
export function registerTool(definition: ToolDefinition) {
  if (toolRegistry.value.has(definition.type)) {
    console.warn(`Tool "${definition.type}" is already registered. Overwriting.`)
  }

  toolRegistry.value.set(definition.type, definition)
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
