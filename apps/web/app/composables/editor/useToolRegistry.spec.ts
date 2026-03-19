import { markRaw } from "vue"
import {
  registerTool,
  unregisterTool,
  clearRegistry,
  getTool,
  getAllTools,
  isToolRegistered,
  useToolRegistry,
  type ToolDefinition
} from "./useToolRegistry"

// Minimal mock component for icon
const FakeIcon = markRaw({ name: "FakeIcon", render: () => null })

function makeTool(type: string, onClick?: () => void): ToolDefinition {
  return {
    type: type as ToolType,
    name: type,
    icon: FakeIcon,
    onClick: onClick ?? vi.fn()
  }
}

describe("useToolRegistry", () => {
  beforeEach(() => {
    clearRegistry()
  })

  it("registers and retrieves a tool", () => {
    const tool = makeTool("area")
    registerTool(tool)

    expect(isToolRegistered("area" as ToolType)).toBe(true)
    expect(getTool("area" as ToolType)).toBe(tool)
  })

  it("unregisters a tool", () => {
    registerTool(makeTool("area"))
    unregisterTool("area" as ToolType)

    expect(isToolRegistered("area" as ToolType)).toBe(false)
  })

  it("returns all registered tools", () => {
    registerTool(makeTool("area"))
    registerTool(makeTool("perimeter"))

    expect(getAllTools()).toHaveLength(2)
  })

  it("skips duplicate registration (same type)", () => {
    const first = makeTool("area")
    const second = makeTool("area")

    registerTool(first)
    registerTool(second)

    expect(getTool("area" as ToolType)).toBe(first)
  })

  describe("clearRegistry allows re-registration with fresh handlers", () => {
    it("clears all tools", () => {
      registerTool(makeTool("area"))
      registerTool(makeTool("perimeter"))

      clearRegistry()

      expect(getAllTools()).toHaveLength(0)
      expect(isToolRegistered("area" as ToolType)).toBe(false)
    })

    it("after clear, tools re-register with new handlers (client-side navigation fix)", () => {
      // Simulate first mount: tools register with handler v1
      const handlerV1 = vi.fn()
      registerTool(makeTool("area", handlerV1))
      expect(getTool("area" as ToolType)!.onClick).toBe(handlerV1)

      // Simulate navigation away: AnnotationLayer unmounts and clears registry
      clearRegistry()

      // Simulate second mount: tools register with handler v2
      const handlerV2 = vi.fn()
      registerTool(makeTool("area", handlerV2))

      // The registry must have the NEW handler, not the stale one
      const registered = getTool("area" as ToolType)!
      expect(registered.onClick).toBe(handlerV2)
      expect(registered.onClick).not.toBe(handlerV1)
    })

    it("without clear, re-registration is skipped and stale handlers remain (the bug)", () => {
      // This test documents the bug that clearRegistry prevents.
      // Without clearRegistry, the duplicate guard keeps the old handler.
      const handlerV1 = vi.fn()
      registerTool(makeTool("area", handlerV1))

      // NO clearRegistry() — simulates the old broken behavior
      const handlerV2 = vi.fn()
      registerTool(makeTool("area", handlerV2))

      // The old (stale) handler is still registered — this was the bug
      expect(getTool("area" as ToolType)!.onClick).toBe(handlerV1)
    })
  })

  it("useToolRegistry returns all public methods", () => {
    const registry = useToolRegistry()

    expect(registry.registerTool).toBe(registerTool)
    expect(registry.clearRegistry).toBe(clearRegistry)
    expect(registry.getTool).toBe(getTool)
    expect(registry.getAllTools).toBe(getAllTools)
    expect(registry.isToolRegistered).toBe(isToolRegistered)
  })
})
