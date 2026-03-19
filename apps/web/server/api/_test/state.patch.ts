import { z } from "zod"
import type { AppTestStatePatch } from "../../utils/test-state"
import { patchTestState, requireTestState } from "../../utils/test-state"

const bodySchema = z.object({
  billing: z
    .object({
      fullSyncResult: z
        .object({
          synced: z.number().int().min(0),
          created: z.number().int().min(0),
          updated: z.number().int().min(0),
          errors: z.number().int().min(0),
          duration: z.number().int().min(0)
        })
        .nullable()
        .optional(),
      refreshStatus: z.string().nullable().optional(),
      cancelStatus: z.string().nullable().optional(),
      reactivateStatus: z.string().nullable().optional(),
      portalUrl: z.string().url().nullable().optional()
    })
    .optional(),
  r2: z
    .object({
      failPut: z.boolean().optional()
    })
    .optional()
})

export default defineEventHandler(async (event) => {
  requireTestState()
  const body = (await readValidatedBody(event, bodySchema.parse)) as AppTestStatePatch
  return patchTestState(body)
})
