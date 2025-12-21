import { eq } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@auth"

const bodySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required")
})

export default defineEventHandler(async (event) => {
  const db = useDrizzle()

  // Get current session
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  // Must be a guest user
  if (!session.user.isGuest) {
    throw createError({
      statusCode: 400,
      statusMessage: "Only guest users can upgrade"
    })
  }

  // Validate body
  const body = await readBody(event)
  const result = bodySchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.issues[0]?.message || "Invalid input"
    })
  }

  const { firstName, lastName } = result.data

  // Update user: set names, remove guest status
  await db
    .update(user)
    .set({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      isGuest: false,
      guestOrganizationId: null
    })
    .where(eq(user.id, session.user.id))

  // Create their home organization
  const orgSlug = `${session.user.email.split("@")[0]}-${session.user.id.slice(0, 8)}`

  await auth.api.createOrganization({
    body: {
      name: `${firstName}'s Organization`,
      slug: orgSlug,
      userId: session.user.id
    }
  })

  return {
    success: true,
    message: "Account upgraded successfully"
  }
})
