import { z } from "zod"
import { eq } from "drizzle-orm"
import { sanitiseProjectSharesForProjectResponse } from "#shared/utils/project-share"

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
              type: "object"
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
  const { orgId } = await requireActiveOrg(event)

  // Validate route params
  const { id: projectId } = await getValidatedRouterParams(event, paramsSchema.parse)

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
  if (projectData.organizationId !== orgId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied"
    })
  }

  // Get files for this project
  const files = await db
    .select({
      id: projectFile.id,
      projectId: projectFile.projectId,
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
