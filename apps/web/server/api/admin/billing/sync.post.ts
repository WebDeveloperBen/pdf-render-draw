import { billingSyncService } from "../../../services/billing/billing.sync"

defineRouteMeta({
  openAPI: {
    tags: ["Admin Billing"],
    summary: "Sync from Stripe",
    description: "Pull all subscriptions and plans from Stripe into local database. Admin waits for result.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              mode: { type: "string", enum: ["full"], default: "full" }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Sync results",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                synced: { type: "number" },
                created: { type: "number" },
                updated: { type: "number" },
                errors: { type: "number" }
              },
              required: ["synced", "created", "updated", "errors"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires admin tier" }
    }
  }
})

export default defineEventHandler(async (event) => {
  await requirePlatformAdminTier(event, "admin")

  const admin = await getPlatformAdmin(event)
  if (!admin) throw createError({ statusCode: 403, message: "Admin not found" })

  const result = await billingSyncService.fullSync(admin.userId)

  // Audit log the sync run
  await logAdminActionFromEvent(event, {
    adminId: admin.userId,
    actionType: "billing.sync.full",
    metadata: {
      synced: result.synced,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      duration: result.duration
    }
  })

  return {
    synced: result.synced,
    created: result.created,
    updated: result.updated,
    errors: result.errors
  }
})
