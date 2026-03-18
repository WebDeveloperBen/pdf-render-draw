import { z } from "zod"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"

const bodySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be at most 100 characters"),
  description: z.string().max(500).nullish(),
  // Reference / Job number
  reference: z.string().max(50).nullish(),
  // Project category
  category: z.string().max(50).nullish(),
  // Job site location
  siteAddress: z.string().max(200).nullish(),
  suburb: z.string().max(100).nullish(),
  postcode: z.string().max(10).nullish(),
  // Client information
  clientName: z.string().max(100).nullish(),
  clientEmail: z.string().email().nullish().or(z.literal("")),
  clientPhone: z.string().max(20).nullish(),
  // Priority and organisation
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  tags: z.array(z.string().max(50)).max(20).default([]),
  notes: z.string().max(2000).nullish(),
  // File data for the initial file
  pdfUrl: z.url({ message: "Invalid PDF URL" }),
  pdfFileName: z.string().min(1, "File name is required"),
  pdfFileSize: z.number().positive("File size must be positive"),
  pageCount: z.number().int().min(0).default(0)
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
              name: { type: "string", description: "Project name" },
              description: { type: "string", nullable: true, description: "Project description" },
              reference: { type: "string", nullable: true, description: "Reference / Job number" },
              category: { type: "string", nullable: true, description: "Project category" },
              siteAddress: { type: "string", nullable: true, description: "Job site street address" },
              suburb: { type: "string", nullable: true, description: "Suburb" },
              postcode: { type: "string", nullable: true, description: "Postcode" },
              clientName: { type: "string", nullable: true, description: "Client name" },
              clientEmail: { type: "string", nullable: true, description: "Client email" },
              clientPhone: { type: "string", nullable: true, description: "Client phone" },
              priority: {
                type: "string",
                enum: ["low", "normal", "high", "urgent"],
                default: "normal",
                description: "Priority level"
              },
              tags: { type: "array", items: { type: "string" }, description: "Project tags" },
              notes: { type: "string", nullable: true, description: "Internal notes" },
              pdfUrl: { type: "string", format: "uri", description: "URL to the PDF file" },
              pdfFileName: { type: "string", description: "Original PDF file name" },
              pdfFileSize: { type: "number", description: "PDF file size in bytes" },
              pageCount: { type: "integer", default: 0, description: "Number of pages in the PDF" }
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
                      createdAt: { type: "string", format: "date-time" }
                    },
                    required: [
                      "id",
                      "pdfUrl",
                      "pdfFileName",
                      "pdfFileSize",
                      "pageCount",
                      "annotationCount",
                      "createdAt"
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
      400: { description: "Bad request - validation error or no active organization" },
      401: { description: "Unauthorized - authentication required" }
    }
  }
})

export default defineEventHandler(async (event) => {
  const { user: authUser, orgId } = await requireActiveOrg(event)

  // Validate body
  const body = await readValidatedBody(event, bodySchema.parse)

  // Check project quota before creating
  await requireProjectQuota(event)

  const db = useDrizzle()

  // Create the project
  const projectId = randomUUID()
  const fileId = randomUUID()

  // Create project with all details
  await db.insert(project).values({
    id: projectId,
    name: body.name,
    description: body.description ?? null,
    reference: body.reference ?? null,
    category: body.category ?? null,
    siteAddress: body.siteAddress ?? null,
    suburb: body.suburb ?? null,
    postcode: body.postcode ?? null,
    clientName: body.clientName ?? null,
    clientEmail: body.clientEmail || null,
    clientPhone: body.clientPhone ?? null,
    priority: body.priority,
    tags: body.tags,
    notes: body.notes ?? null,
    annotationCount: 0,
    createdBy: authUser.id,
    organizationId: orgId,
    lastViewedAt: null
  })

  // Create initial file for the project
  await db.insert(projectFile).values({
    id: fileId,
    projectId,
    pdfUrl: body.pdfUrl,
    pdfFileName: body.pdfFileName,
    pdfFileSize: body.pdfFileSize,
    pageCount: body.pageCount,
    annotationCount: 0,
    uploadedBy: authUser.id,
    lastViewedAt: null
  })

  // Fetch the project with relations
  const [projectWithRelations] = await db
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

  // Fetch the created file
  const files = await db
    .select({
      id: projectFile.id,
      pdfUrl: projectFile.pdfUrl,
      pdfFileName: projectFile.pdfFileName,
      pdfFileSize: projectFile.pdfFileSize,
      pageCount: projectFile.pageCount,
      annotationCount: projectFile.annotationCount,
      createdAt: projectFile.createdAt
    })
    .from(projectFile)
    .where(eq(projectFile.projectId, projectId))

  setResponseStatus(event, 201)
  return {
    ...projectWithRelations,
    files,
    shares: [],
    _count: {
      shares: 0,
      files: files.length
    }
  }
})
