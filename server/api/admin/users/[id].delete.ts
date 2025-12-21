import { z } from "zod"
import { eq } from "drizzle-orm"
import { auth } from "@auth"
import { nanoid } from "nanoid"

const paramsSchema = z.object({
  id: z.string().min(1, "User ID is required")
})

const bodySchema = z.object({
  hardDelete: z.boolean().optional().default(false),
  confirmation: z.literal(true).describe("Deletion must be explicitly confirmed")
})

export default defineEventHandler(async (event) => {
  // Require admin tier (admin or owner) - support/viewer cannot delete
  await requirePlatformAdminTier(event, "admin")

  const { id: targetUserId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDrizzle()

  // Get current admin's session
  const currentSession = await auth.api.getSession({ headers: event.headers })
  const currentUserId = currentSession?.user?.id

  if (!currentUserId) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required"
    })
  }

  // Prevent self-deletion
  if (targetUserId === currentUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Cannot delete your own account through admin panel"
    })
  }

  // Check if target user exists
  const [targetUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email
    })
    .from(user)
    .where(eq(user.id, targetUserId))

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found"
    })
  }

  // Check if target is a platform admin
  const [targetPlatformAdmin] = await db
    .select({
      tier: platformAdmin.tier
    })
    .from(platformAdmin)
    .where(eq(platformAdmin.userId, targetUserId))

  // Only owners can delete other platform admins
  if (targetPlatformAdmin) {
    const isOwner = await isPlatformOwner(event)
    if (!isOwner) {
      throw createError({
        statusCode: 403,
        statusMessage: "Only platform owners can delete platform admin accounts"
      })
    }

    // Owners cannot delete other owners
    if (targetPlatformAdmin.tier === "owner") {
      throw createError({
        statusCode: 403,
        statusMessage: "Cannot delete platform owner accounts"
      })
    }
  }

  // Get IP and User-Agent for audit log
  const ipAddress = getRequestIP(event, { xForwardedFor: true }) || null
  const userAgent = getHeader(event, "user-agent") || null

  // Transaction for atomic operations
  await db.transaction(async (tx) => {
    if (body.hardDelete) {
      // Hard delete: Remove all related data

      // Delete user's sessions
      await tx.delete(session).where(eq(session.userId, targetUserId))

      // Delete user's accounts (OAuth connections)
      await tx.delete(account).where(eq(account.userId, targetUserId))

      // Delete user's API keys
      await tx.delete(apiKey).where(eq(apiKey.userId, targetUserId))

      // Delete user's organization memberships
      await tx.delete(member).where(eq(member.userId, targetUserId))

      // Delete user's team memberships
      await tx.delete(teamMember).where(eq(teamMember.userId, targetUserId))

      // Delete invitations sent by the user
      await tx.delete(invitation).where(eq(invitation.inviterId, targetUserId))

      // Delete user's platform admin record if exists
      await tx.delete(platformAdmin).where(eq(platformAdmin.userId, targetUserId))

      // Delete project shares created by the user
      await tx.delete(projectShare).where(eq(projectShare.createdBy, targetUserId))

      // Delete user's projects (cascade will handle this, but be explicit)
      await tx.delete(project).where(eq(project.createdBy, targetUserId))

      // Finally delete the user
      await tx.delete(user).where(eq(user.id, targetUserId))
    } else {
      // Soft delete: Ban the user permanently with a special reason
      await tx
        .update(user)
        .set({
          banned: true,
          banReason: "Account deleted by administrator",
          banExpires: null, // Permanent
          updatedAt: new Date()
        })
        .where(eq(user.id, targetUserId))

      // Revoke all active sessions
      await tx.delete(session).where(eq(session.userId, targetUserId))

      // Revoke all API keys
      await tx.delete(apiKey).where(eq(apiKey.userId, targetUserId))
    }

    // Create audit log entry
    await tx.insert(adminAuditLog).values({
      id: nanoid(),
      adminId: currentUserId,
      actionType: body.hardDelete ? "user_hard_delete" : "user_soft_delete",
      targetUserId: targetUserId,
      metadata: JSON.stringify({
        userName: targetUser.name,
        userEmail: targetUser.email,
        hardDelete: body.hardDelete,
        wasPlatformAdmin: !!targetPlatformAdmin,
        platformAdminTier: targetPlatformAdmin?.tier || null
      }),
      ipAddress,
      userAgent,
      createdAt: new Date()
    })
  })

  return {
    success: true,
    message: body.hardDelete
      ? `User ${targetUser.email} has been permanently deleted`
      : `User ${targetUser.email} has been deactivated`,
    userId: targetUserId,
    hardDelete: body.hardDelete
  }
})
