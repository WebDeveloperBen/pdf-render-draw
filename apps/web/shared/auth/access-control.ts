import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc, ownerAc, memberAc } from "better-auth/plugins/organization/access"
import {
  defaultStatements as adminDefaultStatements,
  adminAc as betterAuthAdminAc
} from "better-auth/plugins/admin/access"

/**
 * Custom permission statements
 * Extends better-auth defaults with project-specific permissions
 * Includes both organization and admin plugin statements
 */
export const statements = {
  ...defaultStatements,
  ...adminDefaultStatements,
  project: ["create", "read", "update", "delete", "share"]
} as const

/**
 * Access control instance with our custom statements
 */
export const ac = createAccessControl(statements)

/**
 * Role definitions with permissions
 * - owner: Full control over everything (org level)
 * - admin: Can manage projects and members, but not delete org (org level)
 * - member: Can create and read projects only (org level)
 * - platform_admin: Full admin capabilities (platform level)
 */
export const ownerRole = ac.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete", "share"]
})

export const adminRole = ac.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update", "delete", "share"]
})

export const memberRole = ac.newRole({
  ...memberAc.statements,
  project: ["create", "read"]
})

// Platform admin role with full admin plugin capabilities
export const platformAdminRole = ac.newRole({
  ...betterAuthAdminAc.statements,
  project: ["create", "read", "update", "delete", "share"]
})

/**
 * Roles object for better-auth plugin configuration
 */
export const roles = {
  owner: ownerRole,
  admin: adminRole,
  member: memberRole,
  platform_admin: platformAdminRole
}
