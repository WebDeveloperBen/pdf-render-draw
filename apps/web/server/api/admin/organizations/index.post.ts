import { z } from "zod"
import { eq, sql } from "drizzle-orm"
import { auth } from "@auth"

const bodySchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters"),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  logo: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  userId: z.string().min(1, "User ID is required")
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "Create Organization",
    description: "Create a new organization on behalf of a user",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Organization name"
              },
              slug: {
                type: "string",
                description: "Organization slug (lowercase, numbers, hyphens only)"
              },
              logo: {
                type: "string",
                format: "uri",
                description: "Organization logo URL"
              },
              metadata: {
                type: "object",
                description: "Additional organization metadata"
              },
              userId: {
                type: "string",
                description: "ID of the user to create the organization for"
              }
            },
            required: ["name", "slug", "userId"]
          }
        }
      }
    },
    responses: {
      201: {
        description: "Organization created successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
                logo: { type: "string", nullable: true },
                metadata: { type: "object", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                memberCount: { type: "number" },
                projectCount: { type: "number" }
              },
              required: ["id", "name", "slug", "createdAt", "memberCount", "projectCount"]
            }
          }
        }
      },
      400: {
        description: "Bad request - validation error or slug already taken"
      },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - insufficient permissions" },
      409: { description: "Conflict - slug already exists" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require platform admin access
  await requirePlatformAdmin(event)

  const body = await readValidatedBody(event, bodySchema.parse)

  try {
    // Use better-auth's createOrganization function
    const result = await auth.api.createOrganization({
      body: {
        name: body.name,
        slug: body.slug,
        logo: body.logo,
        metadata: body.metadata,
        userId: body.userId
      }
    })

    // Get additional counts for the response
    const db = useDrizzle()

    const [memberCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(member)
      .where(eq(member.organizationId, result.id))

    const [projectCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(project)
      .where(eq(project.organizationId, result.id))

    setResponseStatus(event, 201)
    return {
      ...result,
      memberCount: memberCount?.count ?? 0,
      projectCount: projectCount?.count ?? 0
    }
  } catch (error: unknown) {
    // Handle slug conflicts
    if (
      (error instanceof Error && error.message.includes("slug")) ||
      (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 409)
    ) {
      throw createError({
        statusCode: 409,
        statusMessage: "Organization slug already exists"
      })
    }
    throw error
  }
})
