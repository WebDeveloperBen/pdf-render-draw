import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc, ownerAc, memberAc } from "better-auth/plugins/organization/access"

/**
 * Custom permission statements for MetreMate
 * Extends better-auth defaults with project-specific permissions
 */
export const statements = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete", "share"]
} as const

/**
 * Access control instance with our custom statements
 */
export const ac = createAccessControl(statements)

/**
 * Role definitions with permissions
 * - owner: Full control over everything
 * - admin: Can manage projects and members, but not delete org
 * - member: Can create and read projects only
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

/**
 * Roles object for better-auth plugin configuration
 */
export const roles = {
  owner: ownerRole,
  admin: adminRole,
  member: memberRole
}
