/**
 * Tool component registry — single source of truth.
 * Import this map instead of individual tool components.
 */
import ToolsMeasure from "./Measure.vue"
import ToolsCount from "./Count.vue"
import ToolsArea from "./Area.vue"
import ToolsPerimeter from "./Perimeter.vue"
import ToolsLine from "./Line.vue"
import ToolsFill from "./Fill.vue"
import ToolsText from "./Text.vue"

export const toolComponents = {
  measure: ToolsMeasure,
  count: ToolsCount,
  area: ToolsArea,
  perimeter: ToolsPerimeter,
  line: ToolsLine,
  fill: ToolsFill,
  text: ToolsText
} as const
