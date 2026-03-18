import { z } from "zod"
defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "List Subscriptions",
    description: "List all subscriptions with pagination, search, and filters",
    parameters: [
      { name: "page", in: "query", schema: { type: "number", default: 1 } },
      { name: "limit", in: "query", schema: { type: "number", default: 20 } },
      { name: "search", in: "query", schema: { type: "string" } },
      { name: "status", in: "query", schema: { type: "string" }, description: "Comma-separated statuses" },
      { name: "plan", in: "query", schema: { type: "string" } },
      {
        name: "sortBy",
        in: "query",
        schema: { type: "string", enum: ["organizationName", "status", "periodEnd", "plan"] }
      },
      { name: "sortOrder", in: "query", schema: { type: "string", enum: ["asc", "desc"] } }
    ],
    responses: {
      200: {
        description: "Paginated subscription list",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                subscriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      stripeSubscriptionId: { type: "string", nullable: true },
                      referenceId: { type: "string" },
                      organizationName: { type: "string" },
                      organizationSlug: { type: "string" },
                      organizationLogo: { type: "string", nullable: true },
                      stripeCustomerId: { type: "string", nullable: true },
                      plan: { type: "string" },
                      planTier: { type: "string", enum: ["free", "starter", "professional", "team", "enterprise"] },
                      status: { type: "string" },
                      periodStart: { type: "string", nullable: true },
                      periodEnd: { type: "string", nullable: true },
                      cancelAtPeriodEnd: { type: "boolean", nullable: true },
                      billingInterval: { type: "string", nullable: true },
                      trialEnd: { type: "string", nullable: true }
                    },
                    required: [
                      "id",
                      "referenceId",
                      "organizationName",
                      "organizationSlug",
                      "plan",
                      "planTier",
                      "status"
                    ]
                  }
                },
                pagination: {
                  type: "object",
                  properties: {
                    page: { type: "number" },
                    limit: { type: "number" },
                    total: { type: "number" },
                    totalPages: { type: "number" }
                  },
                  required: ["page", "limit", "total", "totalPages"]
                }
              },
              required: ["subscriptions", "pagination"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" }
    }
  }
})

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  plan: z.string().optional(),
  sortBy: z.enum(["organizationName", "status", "periodEnd", "plan"]).default("periodEnd"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema.parse)

  return billingService.listSubscriptions({
    page: query.page,
    limit: query.limit,
    search: query.search,
    status: query.status,
    plan: query.plan,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder
  })
})
