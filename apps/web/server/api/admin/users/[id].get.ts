import { z } from "zod"
import { eq, sql } from "drizzle-orm"

const paramsSchema = z.object({
  id: z.string().min(1, "User ID is required")
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "Get User",
    description: "Get detailed user information for admin management",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "User ID"
      }
    ],
    responses: {
      200: {
        description: "Detailed user information",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string" },
                emailVerified: { type: "boolean", nullable: true },
                image: { type: "string", nullable: true },
                role: { type: "string" },
                banned: { type: "boolean" },
                banReason: { type: "string", nullable: true },
                banExpires: { type: "string", format: "date-time", nullable: true },
                firstName: { type: "string", nullable: true },
                lastName: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                memberships: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      role: { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                      organization: {
                        type: "object",
                        nullable: true,
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          slug: { type: "string" },
                          logo: { type: "string", nullable: true }
                        }
                      }
                    },
                    required: ["id", "role", "createdAt"]
                  }
                },
                _count: {
                  type: "object",
                  properties: {
                    projects: { type: "number" },
                    activeSessions: { type: "number" }
                  },
                  required: ["projects", "activeSessions"]
                }
              },
              required: ["id", "name", "email", "role", "banned", "createdAt", "updatedAt", "memberships", "_count"]
            }
          }
        }
      },
      403: { description: "Forbidden - requires platform admin access" },
      404: { description: "User not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { id: userId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const db = useDrizzle()

  // Get user with their organizations
  const [userData] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    })
    .from(user)
    .where(eq(user.id, userId))

  if (!userData) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found"
    })
  }

  // Get user's organization memberships
  const memberships = await db
    .select({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo
      }
    })
    .from(member)
    .leftJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))

  // Get user's project count
  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(eq(project.createdBy, userId))

  // Get active sessions count
  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(session)
    .where(sql`${session.userId} = ${userId} AND ${session.expiresAt} > now()`)

  return {
    ...userData,
    memberships,
    _count: {
      projects: projectCount?.count ?? 0,
      activeSessions: sessionCount?.count ?? 0
    }
  }
})
