import { z } from "zod"
import { eq, sql } from "drizzle-orm"

const paramsSchema = z.object({
  id: z.string().min(1, "Organization ID is required")
})

const bodySchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters")
    .optional(),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens")
    .optional(),
  logo: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional()
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "Update Organization",
    description: "Update organization settings",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Organization ID"
      }
    ],
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
                nullable: true,
                description: "Organization logo URL"
              },
              metadata: {
                type: "object",
                nullable: true,
                description: "Additional organization metadata"
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Organization updated successfully",
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
                _count: {
                  type: "object",
                  properties: {
                    members: { type: "number" },
                    projects: { type: "number" }
                  },
                  required: ["members", "projects"]
                }
              },
              required: ["id", "name", "slug", "createdAt", "_count"]
            }
          }
        }
      },
      400: {
        description: "Bad request - validation error or slug already taken"
      },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - insufficient permissions" },
      404: { description: "Organization not found" },
      409: { description: "Conflict - slug already exists" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { id: orgId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()

  // Check if organization exists
  const [existingOrg] = await db.select().from(organization).where(eq(organization.id, orgId))

  if (!existingOrg) {
    throw createError({
      statusCode: 404,
      statusMessage: "Organization not found"
    })
  }

  // Check if slug is being changed and if it's already taken
  if (body.slug && body.slug !== existingOrg.slug) {
    const [slugConflict] = await db.select().from(organization).where(eq(organization.slug, body.slug))

    if (slugConflict) {
      throw createError({
        statusCode: 409,
        statusMessage: "Organization slug already exists"
      })
    }
  }

  // Build update data
  const updateData: Partial<typeof organization.$inferInsert> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.slug !== undefined) updateData.slug = body.slug
  if (body.logo !== undefined) updateData.logo = body.logo
  if (body.metadata !== undefined) updateData.metadata = JSON.stringify(body.metadata)

  // Update organization
  await db.update(organization).set(updateData).where(eq(organization.id, orgId))

  // Fetch updated organization with counts
  const [updatedOrg] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      metadata: organization.metadata,
      createdAt: organization.createdAt
    })
    .from(organization)
    .where(eq(organization.id, orgId))

  // Get counts
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.organizationId, orgId))

  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(eq(project.organizationId, orgId))

  return {
    ...updatedOrg,
    _count: {
      members: memberCount?.count ?? 0,
      projects: projectCount?.count ?? 0
    }
  }
})
