import { z } from "zod"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@auth"

const bodySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be at most 100 characters"),
  description: z.string().max(500).nullish(),
  pdfUrl: z.url({ message: "Invalid PDF URL" }),
  pdfFileName: z.string().min(1, "File name is required"),
  pdfFileSize: z.number().positive("File size must be positive"),
  thumbnailUrl: z.url().nullish(),
  pageCount: z.number().int().min(1).default(1)
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Projects"],
    summary: "Create Project",
    description: "Create a new project",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                minLength: 3,
                maxLength: 100,
                description: "Project name"
              },
              description: {
                type: "string",
                maxLength: 500,
                nullable: true,
                description: "Project description"
              },
              pdfUrl: {
                type: "string",
                format: "uri",
                description: "URL to the PDF file"
              },
              pdfFileName: {
                type: "string",
                minLength: 1,
                description: "Original PDF file name"
              },
              pdfFileSize: {
                type: "number",
                minimum: 1,
                description: "PDF file size in bytes"
              },
              thumbnailUrl: {
                type: "string",
                format: "uri",
                nullable: true,
                description: "URL to the project thumbnail"
              },
              pageCount: {
                type: "integer",
                minimum: 1,
                default: 1,
                description: "Number of pages in the PDF"
              }
            },
            required: ["name", "pdfUrl", "pdfFileName", "pdfFileSize"]
          }
        }
      }
    },
    responses: {
      201: {
        description: "Project created successfully",
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
                shares: { type: "array", items: { type: "object" } },
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
      401: { description: "Unauthorized - authentication required" }
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

  // Validate body
  const body = await readValidatedBody(event, bodySchema.parse)

  // Get active organization - all projects belong to an organization
  const activeOrgId = session.session.activeOrganizationId

  if (!activeOrgId) {
    throw createError({
      statusCode: 400,
      statusMessage: "No active organization. Please select an organization."
    })
  }

  const db = useDrizzle()

  // Create the project
  const projectId = randomUUID()

  await db.insert(project).values({
    id: projectId,
    name: body.name,
    description: body.description ?? null,
    pdfUrl: body.pdfUrl,
    pdfFileName: body.pdfFileName,
    pdfFileSize: body.pdfFileSize,
    thumbnailUrl: body.thumbnailUrl ?? null,
    pageCount: body.pageCount,
    annotationCount: 0,
    createdBy: session.user.id,
    organizationId: activeOrgId,
    lastViewedAt: null
  })

  // Fetch the project with relations
  const [projectWithRelations] = await db
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

  setResponseStatus(event, 201)
  return {
    ...projectWithRelations,
    shares: [],
    _count: {
      shares: 0
    }
  }
})
