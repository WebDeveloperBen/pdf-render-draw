import type { H3Event } from "h3"
import { auth } from "@auth"
import type { statements } from "../../shared/auth/access-control"

type Statements = typeof statements
type Resource = keyof Statements
type Action<R extends Resource> = Statements[R][number]

type PermissionCheck = {
  [K in Resource]?: Action<K>[]
}

/**
 * Check if the current user has the specified permissions
 * Uses better-auth's built-in hasPermission API
 */
export async function hasPermission(event: H3Event, permissions: PermissionCheck): Promise<boolean> {
  const result = await auth.api.hasPermission({
    headers: event.headers,
    body: {
      permissions
    }
  })

  return result?.success ?? false
}

/**
 * Require permission or throw a 403 error
 */
export async function requirePermission(event: H3Event, permissions: PermissionCheck, message?: string): Promise<void> {
  const allowed = await hasPermission(event, permissions)

  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: message || "You don't have permission to perform this action"
    })
  }
}

/**
 * Check if user can perform project actions
 */
export const projectPermissions = {
  canCreate: (event: H3Event) => hasPermission(event, { project: ["create"] }),
  canRead: (event: H3Event) => hasPermission(event, { project: ["read"] }),
  canUpdate: (event: H3Event) => hasPermission(event, { project: ["update"] }),
  canDelete: (event: H3Event) => hasPermission(event, { project: ["delete"] }),
  canShare: (event: H3Event) => hasPermission(event, { project: ["share"] })
}
