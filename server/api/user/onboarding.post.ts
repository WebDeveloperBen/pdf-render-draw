import { eq } from "drizzle-orm"
import { auth } from "@auth"

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

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
    .where(eq(user.id, session.user.id))

  // Log the onboarding data for analytics/CRM
  console.log("User completed onboarding:", {
    userId: session.user.id,
    email: session.user.email,
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
