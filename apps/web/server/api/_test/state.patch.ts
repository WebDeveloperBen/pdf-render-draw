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

defineRouteMeta({
  openAPI: {
    tags: ["Test"],
    summary: "Patch Test State",
    description: "Update in-memory test helpers used by integration and component tests",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              billing: {
                type: "object",
                nullable: true,
                properties: {
                  fullSyncResult: {
                    type: "object",
                    nullable: true,
                    properties: {
                      synced: { type: "integer", minimum: 0 },
                      created: { type: "integer", minimum: 0 },
                      updated: { type: "integer", minimum: 0 },
                      errors: { type: "integer", minimum: 0 },
                      duration: { type: "integer", minimum: 0 }
                    }
                  },
                  refreshStatus: { type: "string", nullable: true },
                  cancelStatus: { type: "string", nullable: true },
                  reactivateStatus: { type: "string", nullable: true },
                  portalUrl: { type: "string", format: "uri", nullable: true }
                }
              },
              r2: {
                type: "object",
                nullable: true,
                properties: {
                  failPut: { type: "boolean" }
                }
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Updated test state",
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

export default defineEventHandler(async (event) => {
  requireTestState()
  const body = (await readValidatedBody(event, bodySchema.parse)) as AppTestStatePatch
  return patchTestState(body)
})
