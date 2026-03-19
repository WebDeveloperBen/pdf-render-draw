/**
 * AnnotationLayer — tool registry lifecycle test
 *
 * Regression test for stale-handler bug on client-side navigation.
 *
 * The bug: tool registry is a module-level singleton. registerTool() skips
 * duplicates to guard against SSR double-registration. Without clearRegistry()
 * on mount, the second AnnotationLayer instance keeps the OLD (dead) handlers
 * from the first instance, making tools silently stop working.
 *
 * The fix: AnnotationLayer calls clearRegistry() before registering tools.
 * This test mounts the component twice and verifies the second mount's
 * handlers are the ones in the registry.
 */

import { mount } from "@vue/test-utils"
import { setActivePinia, createPinia } from "pinia"
import { markRaw, defineComponent, h } from "vue"
import AnnotationLayer from "./AnnotationLayer.vue"
import { clearRegistry, getTool } from "~/composables/editor/useToolRegistry"

// ── Mocks ──

vi.mock("~/utils/debug", () => ({
  debugLog: vi.fn(),
  debugError: vi.fn()
}))

// Mock tool component registry (imported by AnnotationLayer template)
vi.mock("~/components/Editor/Tools", () => ({
  toolComponents: {}
}))

// Track onClick handlers created per mount so we can assert which one is active
let areaHandlerPerMount: (() => void)[] = []
let perimeterHandlerPerMount: (() => void)[] = []

function makeMockToolFactory(type: string, tracker: (() => void)[]) {
  // Each call creates a NEW handler fn and registers the tool.
  // This mirrors what the real useAreaTool / usePerimeterTool do.
  return () => {
    const handler = vi.fn()
    tracker.push(handler)
    const { registerTool } = useToolRegistry()
    registerTool({
      type: type as ToolType,
      name: type,
      icon: markRaw(defineComponent({ render: () => h("span") })),
      onClick: handler
    })
    return {}
  }
}

// Mock every tool composable that AnnotationLayer calls.
// Area and Perimeter get tracked handlers; the rest are inert stubs.
vi.mock("~/composables/editor/tools/useAreaTool", () => ({
  useAreaTool: () => makeMockToolFactory("area", areaHandlerPerMount)(),
  useAreaToolState: () => null
}))
vi.mock("~/composables/editor/tools/usePerimeterTool", () => ({
  usePerimeterTool: () => makeMockToolFactory("perimeter", perimeterHandlerPerMount)(),
  usePerimeterToolState: () => null
}))

// Inert stubs for the remaining tools — they just register a no-op
function stubToolFactory(type: string) {
  return () => {
    const { registerTool } = useToolRegistry()
    registerTool({
      type: type as ToolType,
      name: type,
      icon: markRaw(defineComponent({ render: () => h("span") })),
      onClick: vi.fn()
    })
    return {}
  }
}

vi.mock("~/composables/editor/tools/useCountTool", () => ({
  useCountTool: () => stubToolFactory("count")(),
  useCountToolState: () => null
}))
vi.mock("~/composables/editor/tools/useMeasureTool", () => ({
  useMeasureTool: () => stubToolFactory("measure")(),
  useMeasureToolState: () => null
}))
vi.mock("~/composables/editor/tools/useLineTool", () => ({
  useLineTool: () => stubToolFactory("line")(),
  useLineToolState: () => null
}))
vi.mock("~/composables/editor/tools/useTextTool", () => ({
  useTextTool: () => stubToolFactory("text")(),
  useTextToolState: () => null
}))
vi.mock("~/composables/editor/tools/useFillTool", () => ({
  useFillTool: () => stubToolFactory("fill")(),
  useFillToolState: () => null
}))

// Stub composables that AnnotationLayer uses but aren't relevant to this test
vi.mock("~/composables/editor/useEditorMarquee", () => ({
  useEditorMarquee: () => ({
    startMarquee: vi.fn(),
    marqueeBounds: ref(null)
  })
}))
vi.mock("~/composables/editor/useInteractionMode", () => ({
  useInteractionMode: () => ({
    isMode: () => false,
    shouldSuppressClick: computed(() => false)
  })
}))
vi.mock("~/composables/editor/useSnapProvider", () => ({
  useSnapProvider: () => ({
    extractPageContent: vi.fn(),
    clearContentCache: vi.fn(),
    clearIndicator: vi.fn(),
    snapDebugEnabled: ref(false)
  })
}))
vi.mock("~/composables/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: vi.fn()
}))

// ── Tests ──

describe("AnnotationLayer tool registry lifecycle", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    clearRegistry()
    areaHandlerPerMount = []
    perimeterHandlerPerMount = []
  })

  it("first mount registers tools with fresh handlers", () => {
    const wrapper = mount(AnnotationLayer)

    expect(getTool("area" as ToolType)).toBeDefined()
    expect(getTool("perimeter" as ToolType)).toBeDefined()
    expect(areaHandlerPerMount).toHaveLength(1)
    expect(perimeterHandlerPerMount).toHaveLength(1)

    wrapper.unmount()
  })

  it("second mount replaces stale handlers with fresh ones (client-side navigation)", () => {
    // --- First mount (initial editor session) ---
    const first = mount(AnnotationLayer)
    const areaHandlerV1 = areaHandlerPerMount[0]!
    const perimeterHandlerV1 = perimeterHandlerPerMount[0]!

    expect(getTool("area" as ToolType)!.onClick).toBe(areaHandlerV1)
    expect(getTool("perimeter" as ToolType)!.onClick).toBe(perimeterHandlerV1)

    first.unmount()

    // --- Second mount (navigated back to editor) ---
    const second = mount(AnnotationLayer)

    // New handlers should have been created
    expect(areaHandlerPerMount).toHaveLength(2)
    expect(perimeterHandlerPerMount).toHaveLength(2)

    const areaHandlerV2 = areaHandlerPerMount[1]!
    const perimeterHandlerV2 = perimeterHandlerPerMount[1]!

    // Registry MUST have the new handlers, not the stale ones
    expect(getTool("area" as ToolType)!.onClick).toBe(areaHandlerV2)
    expect(getTool("area" as ToolType)!.onClick).not.toBe(areaHandlerV1)

    expect(getTool("perimeter" as ToolType)!.onClick).toBe(perimeterHandlerV2)
    expect(getTool("perimeter" as ToolType)!.onClick).not.toBe(perimeterHandlerV1)

    second.unmount()
  })
})
