import { resetTestState, requireTestState } from "../../utils/test-state"

export default defineEventHandler(() => {
  requireTestState()
  return resetTestState()
})
