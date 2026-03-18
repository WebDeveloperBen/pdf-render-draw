import { z } from "zod"
import { eq } from "drizzle-orm"

const bodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters").optional(),
  firstName: z.string().min(1, "First name is required").max(50, "First name must be at most 50 characters").optional(),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be at most 50 characters").optional(),
  image: z.string().url().nullable().optional()
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["User"],
    summary: "Update Profile",
    description: "Update current user's profile information",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Full display name"
              },
              firstName: {
                type: "string",
                description: "First name"
              },
              lastName: {
                type: "string",
                description: "Last name"
              },
              image: {
                type: "string",
                format: "uri",
                nullable: true,
                description: "Profile image URL"
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Profile updated successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string", nullable: true },
                firstName: { type: "string", nullable: true },
                lastName: { type: "string", nullable: true },
                email: { type: "string" },
                emailVerified: { type: "boolean", nullable: true },
                image: { type: "string", nullable: true },
                role: { type: "string", nullable: true },
                banned: { type: "boolean" },
                banReason: { type: "string", nullable: true },
                banExpires: { type: "string", format: "date-time", nullable: true },
                isGuest: { type: "boolean" },
                guestOrganizationId: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" }
              },
              required: ["id", "email", "banned", "isGuest", "createdAt", "updatedAt"]
            }
          }
        }
      },
      400: { description: "Bad request - validation error" },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { user: authUser } = await requireAuth(event)

  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()

  // Build update data
  const updateData: Partial<typeof user.$inferInsert> = {
    updatedAt: new Date()
  }

  if (body.name !== undefined) updateData.name = body.name
  if (body.firstName !== undefined) updateData.firstName = body.firstName
  if (body.lastName !== undefined) updateData.lastName = body.lastName
  if (body.image !== undefined) updateData.image = body.image

  // Update user profile
  await db.update(user).set(updateData).where(eq(user.id, authUser.id))

  // Fetch and return updated profile
  const [updatedProfile] = await db
    .select({
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      isGuest: user.isGuest,
      guestOrganizationId: user.guestOrganizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
    .from(user)
    .where(eq(user.id, authUser.id))

  return updatedProfile
})
