import { z } from "zod"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { auth } from "@auth"

const bodySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be at most 100 characters"),
  description: z.string().max(500).optional(),
  pdfUrl: z.url({ message: "Invalid PDF URL" }),
  pdfFileName: z.string().min(1, "File name is required"),
  pdfFileSize: z.number().positive("File size must be positive"),
  thumbnailUrl: z.url().optional(),
  pageCount: z.number().int().min(1).default(1)
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
