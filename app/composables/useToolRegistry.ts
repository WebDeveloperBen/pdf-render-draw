/**
 * Tool Registry - Plugin system for annotation tools
 *
 * Tools register themselves here with their component and configuration.
 * SvgAnnotationLayer automatically discovers and renders all registered tools.
 */

import type { Component } from "vue"
import { ref, markRaw, triggerRef } from "vue"
import type { ToolType, Annotation } from "~/types/annotations"

export interface ToolDefinition {
  /** Unique tool type identifier */
  type: ToolType

  /** Vue component that renders the tool's annotations (optional for direct rendering) */
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

  /** Optional: Transformation metadata and handlers for this tool */
  transform?: {
    /** Data structure type - determines how transforms are applied */
    structure: "point-based" | "positioned"

    /** How this tool handles group rotation during multi-select */
    groupRotation: "update-points" | "update-position-and-rotation" | "none"

    /** Whether this tool supports group resize operations */
    supportsGroupResize: boolean

    /** Whether this tool supports group move operations */
    supportsGroupMove: boolean

    /** How to calculate rotation center - used for single rotation transforms */
    rotationCenter: "centroid" | "midpoint" | "geometric-center" | "custom"

    /** Get the rotation center for this annotation (required if rotationCenter is "custom") */
    getCenter?: (annotation: Annotation) => { x: number; y: number }

    /** Apply rotation to this annotation (optional - default behavior used if not provided) */
    applyRotation?: (annotation: Annotation, rotationDelta: number) => Partial<Annotation>

    /** Apply translation/move to this annotation (optional - default behavior used if not provided) */
    applyMove?: (annotation: Annotation, deltaX: number, deltaY: number) => Partial<Annotation>

    /** Apply scale/resize to this annotation (optional - default behavior used if not provided) */
    applyResize?: (annotation: Annotation, bounds: { x: number; y: number; width: number; height: number }, originalBounds: { x: number; y: number; width: number; height: number }) => Partial<Annotation>
  }
}

// Tool registry - use ref with markRaw to avoid deep reactivity on components
// while still allowing mutations to trigger updates
const toolRegistry = ref(markRaw(new Map<ToolType, ToolDefinition>()))

/**
 * Register a tool in the system
 * Call this in your tool's module to make it available
 */
export function registerTool(definition: ToolDefinition) {
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
  const manualTools: Array<{ id: ToolType | "selection" | "rotate" | ""; name: string; icon: string }> = [
    { id: "rotate", name: "Rotate", icon: "🔄" }
  ]
  return [...registeredTools, ...manualTools]
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(type: ToolType): boolean {
  return toolRegistry.value.has(type)
}

/**
 * Check if a tool should apply rotation transform during multi-select
 */
export function shouldApplyRotationTransform(type: ToolType): boolean {
  const tool = getTool(type)
  return tool?.transform?.groupRotation === "update-position-and-rotation"
}

/**
 * Check if a tool should update points during multi-select rotation
 */
export function shouldUpdatePoints(type: ToolType): boolean {
  const tool = getTool(type)
  return tool?.transform?.groupRotation === "update-points"
}

/**
 * Check if a tool is point-based
 */
export function isPointBasedTool(type: ToolType): boolean {
  const tool = getTool(type)
  return tool?.transform?.structure === "point-based"
}

/**
 * Check if a tool is positioned (has x, y, width, height)
 */
export function isPositionedTool(type: ToolType): boolean {
  const tool = getTool(type)
  return tool?.transform?.structure === "positioned"
}

/**
 * Get all tools with specific group rotation behavior
 */
export function getToolsWithRotationBehavior(
  behavior: "update-points" | "update-position-and-rotation" | "none"
): ToolType[] {
  return getAllTools()
    .filter((tool) => tool.transform?.groupRotation === behavior)
    .map((tool) => tool.type)
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
    getCompleteToolbarTools,
    isToolRegistered,
    // Transform helpers
    shouldApplyRotationTransform,
    shouldUpdatePoints,
    isPointBasedTool,
    isPositionedTool,
    getToolsWithRotationBehavior
  }
}
