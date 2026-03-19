import { z } from "zod"
import { eq, sql } from "drizzle-orm"
import { auth } from "@auth"
import { nanoid } from "nanoid"

const paramsSchema = z.object({
  id: z.string().min(1, "Organization ID is required")
})

const bodySchema = z.object({
  confirmation: z.literal(true).describe("Deletion must be explicitly confirmed"),
  deleteProjects: z.boolean().optional().default(false)
})

// OpenAPI metadata for Orval type generation
defineRouteMeta({
  openAPI: {
    tags: ["Admin"],
    summary: "Delete Organization",
    description: "Permanently delete an organization",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Organization ID to delete"
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              confirmation: {
                type: "boolean",
                enum: [true],
                description: "Must be true to confirm deletion"
              },
              deleteProjects: {
                type: "boolean",
                default: false,
                description: "Whether to also delete all projects in the organization"
              }
            },
            required: ["confirmation"]
          }
        }
      }
    },
    responses: {
      200: {
        description: "Organization deletion successful",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
                organizationId: { type: "string" },
                deletedCounts: {
                  type: "object",
                  properties: {
                    members: { type: "number" },
                    projects: { type: "number" },
                    invitations: { type: "number" }
                  },
                  required: ["members", "projects", "invitations"]
                }
              },
              required: ["success", "message", "organizationId", "deletedCounts"]
            }
          }
        }
      },
      401: { description: "Unauthorized - authentication required" },
      403: { description: "Forbidden - insufficient permissions" },
      404: { description: "Organization not found" }
    }
  }
})

export default defineEventHandler(async (event) => {
  // Require admin tier (admin or owner) - support/viewer cannot delete
  await requirePlatformAdminTier(event, "admin")

  const { id: targetOrgId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()

  // Get current admin's session
  const currentSession = await auth.api.getSession({ headers: toWebRequest(event).headers })
  const currentUserId = currentSession?.user?.id

  if (!currentUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required"
    })
  }

  // Check if target organization exists
  const [targetOrg] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug
    })
    .from(organization)
    .where(eq(organization.id, targetOrgId))

  if (!targetOrg) {
    throw createError({
      statusCode: 404,
      statusMessage: "Organization not found"
    })
  }

  // Get counts for audit log
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.organizationId, targetOrgId))

  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(eq(project.organizationId, targetOrgId))

  const [invitationCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invitation)
    .where(eq(invitation.organizationId, targetOrgId))

  // Get IP and User-Agent for audit log
  const ipAddress = getRequestIP(event, { xForwardedFor: true }) || null
  const userAgent = getHeader(event, "user-agent") || null

  // Transaction for atomic operations
  await db.transaction(async (tx) => {
    // Handle projects based on deleteProjects flag
    if (body.deleteProjects) {
      // Delete all project shares first (for projects in this org)
      const orgProjects = await tx
        .select({ id: project.id })
        .from(project)
        .where(eq(project.organizationId, targetOrgId))

      for (const p of orgProjects) {
        await tx.delete(projectShare).where(eq(projectShare.projectId, p.id))
      }

      // Delete all projects in this organization
      await tx.delete(project).where(eq(project.organizationId, targetOrgId))
    } else {
      // Just disassociate projects from the organization
      await tx.update(project).set({ organizationId: null }).where(eq(project.organizationId, targetOrgId))
    }

    // Cascades will handle:
    // - members (onDelete: cascade)
    // - invitations (onDelete: cascade)
    // - teams (onDelete: cascade)
    // - team members (via team cascade)

    // Delete the organization
    await tx.delete(organization).where(eq(organization.id, targetOrgId))

    // Create audit log entry
    await tx.insert(adminAuditLog).values({
      id: nanoid(),
      adminId: currentUserId,
      actionType: "organization_delete",
      targetOrgId: targetOrgId,
      metadata: JSON.stringify({
        orgName: targetOrg.name,
        orgSlug: targetOrg.slug,
        memberCount: memberCount?.count ?? 0,
        projectCount: projectCount?.count ?? 0,
        invitationCount: invitationCount?.count ?? 0,
        projectsDeleted: body.deleteProjects
      }),
      ipAddress,
      userAgent,
      createdAt: new Date()
    })
  })

  return {
    success: true,
    message: `Organization "${targetOrg.name}" has been permanently deleted`,
    organizationId: targetOrgId,
    deletedCounts: {
      members: memberCount?.count ?? 0,
      projects: body.deleteProjects ? (projectCount?.count ?? 0) : 0,
      invitations: invitationCount?.count ?? 0
    }
  }
})
