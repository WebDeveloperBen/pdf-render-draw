import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { auth } from "@auth"

const paramsSchema = z.object({
  id: z.uuid({ message: "Invalid project ID" })
})

const bodySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be at most 100 characters").optional(),
  description: z.string().max(500).nullable().optional(),
  annotationCount: z.number().int().min(0).optional(),
  lastViewedAt: z.coerce.date().nullable().optional()
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

  // Check if user has permission to update (creator or admin/owner)
  let hasAccess = existingProject.createdBy === session.user.id

  if (!hasAccess) {
    const membership = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, activeOrgId)))
      .limit(1)

    const userMembership = membership[0]
    if (userMembership) {
      hasAccess = userMembership.role === "owner" || userMembership.role === "admin"
    }
  }

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Only project creator or organization admins can update projects."
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
