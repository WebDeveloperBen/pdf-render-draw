import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

const bodySchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be at most 100 characters")
    .optional(),
  description: z.string().max(500).nullable().optional(),
  annotationCount: z.number().int().min(0).optional(),
  lastViewedAt: z.coerce.date().nullable().optional()
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Projects"],
    summary: "Update Project",
    description: "Update a project's metadata",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID (UUID)"
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
                description: "Project name"
              },
              description: {
                type: "string",
                nullable: true,
                description: "Project description"
              },
              annotationCount: {
                type: "integer",
                description: "Number of annotations in the project"
              },
              lastViewedAt: {
                type: "string",
                format: "date-time",
                nullable: true,
                description: "When the project was last viewed"
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: "Project updated successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string", nullable: true },
                pdfUrl: { type: "string" },
                pdfFileName: { type: "string", nullable: true },
                pdfFileSize: { type: "number", nullable: true },
                thumbnailUrl: { type: "string", nullable: true },
                pageCount: { type: "number" },
                annotationCount: { type: "number" },
                lastViewedAt: { type: "string", format: "date-time", nullable: true },
                createdBy: { type: "string" },
                organizationId: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                creator: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    email: { type: "string" },
                    image: { type: "string", nullable: true }
                  },
                  required: ["id", "name", "email"]
                },
                organization: {
                  type: "object",
                  nullable: true,
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    slug: { type: "string" },
                    logo: { type: "string", nullable: true }
                  }
                },
                shares: {
                  type: "array",
                  items: { type: "object" }
                },
                _count: {
                  type: "object",
                  properties: {
                    shares: { type: "number" }
                  },
                  required: ["shares"]
                }
              },
              required: [
                "id",
                "name",
                "pdfUrl",
                "pageCount",
                "annotationCount",
                "createdBy",
                "createdAt",
                "updatedAt",
                "creator",
                "shares",
                "_count"
              ]
            }
          }
        }
      },
      400: { description: "Bad request - validation error or no active organization" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - insufficient permissions or access denied" },
      404: { description: "Project not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  // Check permission to update projects
  await requirePermission(event, { project: ["update"] })

  // Validate route params and body
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  // Get active organization
  const activeOrgId = session.session.activeOrganizationId

  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  const db = useDrizzle()

  // Fetch the project
  const [existingProject] = await db.select().from(project).where(eq(project.id, projectId))

  if (!existingProject) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: project must belong to active organization
  if (existingProject.organizationId !== activeOrgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Build update data from validated body
  const updateData: Partial<typeof project.$inferInsert> = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.annotationCount !== undefined) updateData.annotationCount = body.annotationCount
  if (body.lastViewedAt !== undefined) updateData.lastViewedAt = body.lastViewedAt

  await db.update(project).set(updateData).where(eq(project.id, projectId))

  // Fetch updated project with relations
  const [updatedProject] = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      pdfUrl: project.pdfUrl,
      pdfFileName: project.pdfFileName,
      pdfFileSize: project.pdfFileSize,
      thumbnailUrl: project.thumbnailUrl,
      pageCount: project.pageCount,
      annotationCount: project.annotationCount,
      lastViewedAt: project.lastViewedAt,
      createdBy: project.createdBy,
      organizationId: project.organizationId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo
      }
    })
    .from(project)
    .leftJoin(user, eq(project.createdBy, user.id))
    .leftJoin(organization, eq(project.organizationId, organization.id))
    .where(eq(project.id, projectId))

  // Get shares
  const shares = await db.select().from(projectShare).where(eq(projectShare.projectId, projectId))

  return {
    ...updatedProject,
    shares,
    _count: {
      shares: shares.length
    }
  }
})
