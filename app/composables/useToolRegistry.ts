/**
 * Tool Registry - Plugin system for annotation tools
 *
 * Tools register themselves here with their component and configuration.
 * SvgAnnotationLayer automatically discovers and renders all registered tools.
 */

import type { Component } from "vue"
import type { AnnotationType } from "~/types/annotations"

export interface ToolDefinition {
  /** Unique tool type identifier */
  type: AnnotationType

  /** Vue component that renders the tool's annotations */
  component: Component

  /** Optional: Handler for double-click events on this tool's annotations */
  onDoubleClick?: (annotationId: string) => void

  /** Optional: Handler for context menu events */
  onContextMenu?: (annotationId: string) => void

  /** Optional: Custom event handlers */
  eventHandlers?: Record<string, (annotationId: string, event: Event) => void>
}

// Tool registry - singleton storage
const toolRegistry = new Map<AnnotationType, ToolDefinition>()

/**
 * Register a tool in the system
 * Call this in your tool's module to make it available
 */
export function registerTool(definition: ToolDefinition) {
  if (toolRegistry.has(definition.type)) {
    console.warn(`Tool "${definition.type}" is already registered. Overwriting.`)
  }

  toolRegistry.set(definition.type, definition)
}

/**
 * Unregister a tool (useful for testing or dynamic tool loading)
 */
export function unregisterTool(type: AnnotationType) {
  toolRegistry.delete(type)
}

/**
 * Get a specific tool definition
 */
export function getTool(type: AnnotationType): ToolDefinition | undefined {
  return toolRegistry.get(type)
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values())
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(type: AnnotationType): boolean {
  return toolRegistry.has(type)
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
    isToolRegistered
  }
}
