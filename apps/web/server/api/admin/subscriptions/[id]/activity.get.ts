import { z } from "zod"
defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Get Subscription Activity",
    description: "Get billing activity timeline for a subscription",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
      { name: "limit", in: "query", schema: { type: "number", default: 20 } },
      { name: "offset", in: "query", schema: { type: "number", default: 0 } }
    ],
    responses: {
      200: {
        description: "Activity timeline",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                activities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string" },
                      description: { type: "string" },
                      actorName: { type: "string", nullable: true },
                      actorEmail: { type: "string", nullable: true },
                      metadata: { type: "object", nullable: true },
                      createdAt: { type: "string" }
                    },
                    required: ["id", "type", "description", "createdAt"]
                  }
                }
              },
              required: ["activities"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

const paramsSchema = z.object({
  id: z.string().min(1)
})

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const query = await getValidatedQuery(event, querySchema.parse)

  const activities = await billingService.getActivity(id, query.limit, query.offset)

  return { activities }
})
