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
  const projectId = getRouterParam(event, "id")

  if (!projectId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Project ID is required"
    })
  }

  // Fetch the project
  const [projectData] = await db
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

  if (!projectData) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: user must be creator OR member of the organization
  let hasAccess = projectData.createdBy === session.user.id

  if (!hasAccess && projectData.organizationId) {
    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, projectData.organizationId)))
      .limit(1)

    hasAccess = membership.length > 0
  }

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Get shares for this project
  const shares = await db.select().from(projectShare).where(eq(projectShare.projectId, projectId))

  // Update lastViewedAt
  await db.update(project).set({ lastViewedAt: new Date() }).where(eq(project.id, projectId))

  return {
    ...projectData,
    shares,
    _count: {
      shares: shares.length
    }
  }
})
