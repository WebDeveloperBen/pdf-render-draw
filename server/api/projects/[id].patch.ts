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

  const body = await readBody(event)

  // Fetch the project
  const [existingProject] = await db.select().from(project).where(eq(project.id, projectId))

  if (!existingProject) {
    throw createError({
      statusCode: 404,
      statusMessage: "Project not found"
    })
  }

  // Check access: user must be creator OR organization admin/owner
  let hasAccess = existingProject.createdBy === session.user.id

  if (!hasAccess && existingProject.organizationId) {
    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, existingProject.organizationId)))
      .limit(1)

    if (membership.length > 0) {
      // Check if user has admin or owner role
      const userRole = membership[0].role
      hasAccess = userRole === "owner" || userRole === "admin"
    }
  }

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only project creator or organization admins can update projects."
    })
  }

  // Validate name if provided
  if (body.name !== undefined && (body.name.length < 3 || body.name.length > 100)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Project name must be between 3 and 100 characters"
    })
  }

  // Update the project
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
