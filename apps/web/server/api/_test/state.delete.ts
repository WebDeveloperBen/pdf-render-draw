import { resetTestState, requireTestState } from "../../utils/test-state"

defineRouteMeta({
  openAPI: {
    tags: ["Test"],
    summary: "Reset Test State",
    description: "Reset in-memory test state to defaults",
    responses: {
      200: {
        description: "Reset test state",
        content: {
          "application/json": {
            schema: {
              type: "object"
            }
          }
        }
      }
    }
  }
})

export default defineEventHandler(() => {
  requireTestState()
  return resetTestState()
})
