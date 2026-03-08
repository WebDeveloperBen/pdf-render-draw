import { eq } from "drizzle-orm"
import { auth } from "@auth"

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["User"],
    summary: "Get Profile",
    description: "Get current user's profile information",
    responses: {
      200: {
        description: "User profile information",
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
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()

  const [userProfile] = await db
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
    .where(eq(user.id, session.user.id))

  if (!userProfile) {
    throw createError({
      statusCode: 404,
      statusMessage: "User profile not found"
    })
  }

  return userProfile
})
