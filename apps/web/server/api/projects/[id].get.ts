import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@auth"
import { sanitiseProjectSharesForProjectResponse } from "@shared/utils/project-share"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Projects"],
    summary: "Get Project",
    description: "Get detailed information about a specific project",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Project ID (UUID)"
      }
    ],
    responses: {
      200: {
        description: "Project details with files and shares",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string", nullable: true },
                reference: { type: "string", nullable: true },
                category: { type: "string", nullable: true },
                siteAddress: { type: "string", nullable: true },
                suburb: { type: "string", nullable: true },
                postcode: { type: "string", nullable: true },
                clientName: { type: "string", nullable: true },
                clientEmail: { type: "string", nullable: true },
                clientPhone: { type: "string", nullable: true },
                priority: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                notes: { type: "string", nullable: true },
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
                files: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      pdfUrl: { type: "string" },
                      pdfFileName: { type: "string" },
                      pdfFileSize: { type: "number" },
                      pageCount: { type: "number" },
                      annotationCount: { type: "number" },
                      uploadedBy: { type: "string" },
                      lastViewedAt: { type: "string", format: "date-time", nullable: true },
                      createdAt: { type: "string", format: "date-time" },
                      updatedAt: { type: "string", format: "date-time" },
                      uploader: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          email: { type: "string" },
                          image: { type: "string", nullable: true }
                        },
                        required: ["id", "name", "email"]
                      }
                    },
                    required: [
                      "id",
                      "pdfUrl",
                      "pdfFileName",
                      "pdfFileSize",
                      "pageCount",
                      "annotationCount",
                      "uploadedBy",
                      "createdAt",
                      "updatedAt",
                      "uploader"
                    ]
                  }
                },
                shares: { type: "array", items: { type: "object" } },
                _count: {
                  type: "object",
                  properties: { shares: { type: "number" }, files: { type: "number" } },
                  required: ["shares", "files"]
                }
              },
              required: [
                "id",
                "name",
                "priority",
                "tags",
                "annotationCount",
                "createdBy",
                "createdAt",
                "updatedAt",
                "creator",
                "files",
                "shares",
                "_count"
              ]
            }
          }
        }
      },
      400: { description: "Bad request - no active organization" },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - access denied" },
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

  // Validate route params
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)

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
  const [projectData] = await db
    .select({
      id: project.id,
      name: project.name,
      description: project.description,
      reference: project.reference,
      category: project.category,
      siteAddress: project.siteAddress,
      suburb: project.suburb,
      postcode: project.postcode,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      clientPhone: project.clientPhone,
      priority: project.priority,
      tags: project.tags,
      notes: project.notes,
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

  if (!projectData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: project must belong to active organization
  if (projectData.organizationId !== activeOrgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Get files for this project
  const files = await db
    .select({
      id: projectFile.id,
      pdfUrl: projectFile.pdfUrl,
      pdfFileName: projectFile.pdfFileName,
      pdfFileSize: projectFile.pdfFileSize,
      pageCount: projectFile.pageCount,
      annotationCount: projectFile.annotationCount,
      uploadedBy: projectFile.uploadedBy,
      lastViewedAt: projectFile.lastViewedAt,
      createdAt: projectFile.createdAt,
      updatedAt: projectFile.updatedAt,
      uploader: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      }
    })
    .from(projectFile)
    .leftJoin(user, eq(projectFile.uploadedBy, user.id))
    .where(eq(projectFile.projectId, projectId))
    .orderBy(projectFile.createdAt)

  // Get shares for this project
  const shares = await db.select().from(projectShare).where(eq(projectShare.projectId, projectId))
  const safeShares = sanitiseProjectSharesForProjectResponse(shares)

  // Update lastViewedAt
  await db.update(project).set({ lastViewedAt: new Date() }).where(eq(project.id, projectId))

  return {
    ...projectData,
    files,
    shares: safeShares,
    _count: {
      shares: safeShares.length,
      files: files.length
    }
  }
})
