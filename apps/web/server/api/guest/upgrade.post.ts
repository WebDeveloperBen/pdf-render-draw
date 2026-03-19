import { eq } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@auth"

const bodySchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required")
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Guest"],
    summary: "Upgrade Guest Account",
    description: "Upgrade a guest user account to a full user account",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              firstName: {
                type: "string",
                description: "User's first name"
              },
              lastName: {
                type: "string",
                description: "User's last name"
              }
            },
            required: ["firstName", "lastName"]
          }
        }
      }
    },
    responses: {
      200: {
        description: "Account upgrade successful",
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
      400: {
        description: "Bad request - validation error or user is not a guest"
      },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const db = useDrizzle()

  const { user: authUser } = await requireAuth(event)

  // Must be a guest user
  if (!authUser.isGuest) {
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
  const orgSlug = `${authUser.email.split("@")[0]}-${authUser.id.slice(0, 8)}`

  const [existingOrg] = await db.select({ id: organization.id }).from(organization).where(eq(organization.slug, orgSlug))
  if (existingOrg) {
    throw createError({
      statusCode: 409,
      statusMessage: "Organization slug already exists"
    })
  }

  const createdOrg = await auth.api.createOrganization({
    body: {
      name: `${firstName}'s Organization`,
      slug: orgSlug,
      userId: authUser.id
    }
  })

  try {
    await db
      .update(user)
      .set({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        isGuest: false,
        guestOrganizationId: null
      })
      .where(eq(user.id, authUser.id))
  } catch (error) {
    await db.delete(organization).where(eq(organization.id, createdOrg.id))
    throw error
  }

  return {
    success: true,
    message: "Account upgraded successfully"
  }
})
