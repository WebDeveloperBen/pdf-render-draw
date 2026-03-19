import { eq } from "drizzle-orm"

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["User"],
    summary: "Complete Onboarding",
    description: "Complete user onboarding process",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              companyName: { type: "string" },
              role: { type: "string" },
              teamSize: { type: "string" },
              selectedPlan: {
                type: "string",
                enum: ["free", "professional", "team", "enterprise"]
              },
              selectedSeats: { type: "integer", minimum: 1 }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Onboarding completed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" }
              },
              required: ["success", "message"]
            }
          }
        }
      },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { user: authUser } = await requireAuth(event)

  const body = await readBody(event)
  const db = useDrizzle()

  // Update user with onboarding data
  // For now, we'll store this in the user's metadata
  // In production, you might want a separate onboarding table

  await db
    .update(user)
    .set({
      // Store onboarding metadata - you may need to add these fields to your schema
      // For now, we'll just acknowledge the completion
      updatedAt: new Date()
    })
    .where(eq(user.id, authUser.id))

  // Log the onboarding data for analytics/CRM
  console.log("User completed onboarding:", {
    userId: authUser.id,
    email: authUser.email,
    ...body
  })

  // TODO: Send to your analytics platform (Segment, Mixpanel, etc.)
  // TODO: Update CRM (HubSpot, Salesforce, etc.)
  // TODO: Send welcome email

  return {
    success: true,
    message: "Onboarding completed successfully"
  }
})
