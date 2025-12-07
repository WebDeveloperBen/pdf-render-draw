import { randomUUID } from "crypto"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

export default defineEventHandler(async (event) => {
  // Check authentication
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized"
    })
  }

  const db = useDrizzle()
  const body = await readBody(event)

  // Validate required fields
  if (!body.name || !body.pdfUrl || !body.pdfFileName || !body.pdfFileSize) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required fields"
    })
  }

  // Validate name length
  if (body.name.length < 3 || body.name.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: "Project name must be between 3 and 100 characters"
    })
  }

  // If organizationId is provided, check if user is a member
  if (body.organizationId) {
    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, body.organizationId)))
      .limit(1)

    if (membership.length === 0) {
      throw createError({
        statusCode: 403,
        statusMessage: "You are not a member of this organization"
      })
    }
  }

  // Create the project
  const projectId = randomUUID()

  await db
    .insert(project)
    .values({
      id: projectId,
      name: body.name,
      description: body.description || null,
      pdfUrl: body.pdfUrl,
      pdfFileName: body.pdfFileName,
      pdfFileSize: body.pdfFileSize,
      thumbnailUrl: body.thumbnailUrl || null,
      pageCount: body.pageCount,
      annotationCount: 0,
      createdBy: session.user.id,
      organizationId: body.organizationId || null,
      lastViewedAt: null
    })
    .returning()

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
