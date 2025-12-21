import type { InferSelectModel } from "drizzle-orm"
import type { user, organization, member, platformAdmin, adminAuditLog } from "../db/schema"

// Base types inferred from Drizzle schema
export type User = InferSelectModel<typeof user>
export type Organization = InferSelectModel<typeof organization>
export type Member = InferSelectModel<typeof member>
export type PlatformAdmin = InferSelectModel<typeof platformAdmin>
export type AdminAuditLog = InferSelectModel<typeof adminAuditLog>

// ============================================
// Dashboard Statistics
// ============================================

export interface AdminStats {
  users: {
    total: number
    recentSignups: number
    banned: number
  }
  organizations: {
    total: number
  }
  projects: {
    total: number
  }
  sessions: {
    active: number
  }
}

// ============================================
// User Types
// ============================================

export interface AdminUser {
  id: string
  name: string | null
  email: string
  emailVerified: boolean
  image: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AdminUserDetail extends AdminUser {
  firstName: string | null
  lastName: string | null
  memberships: Array<{
    id: string
    role: string
    createdAt: Date
    organization: {
      id: string
      name: string
      slug: string | null
      logo: string | null
    } | null
  }>
  _count: {
    projects: number
    activeSessions: number
  }
}

export interface AdminUsersResponse {
  users: AdminUser[]
  pagination: PaginationInfo
}

// Alias for backward compatibility
export type UsersResponse = AdminUsersResponse

// ============================================
// Organization Types
// ============================================

export interface AdminOrganization {
  id: string
  name: string
  slug: string
  logo: string | null
  createdAt: Date
  memberCount: number
}

export interface AdminOrgMember {
  id: string
  role: string
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    banned: boolean | null
  } | null
}

export interface AdminOrganizationDetail {
  id: string
  name: string
  slug: string
  logo: string | null
  metadata: string | null
  createdAt: Date
  members: AdminOrgMember[]
  _count: {
    members: number
    projects: number
    pendingInvitations: number
  }
}

export interface AdminOrganizationsResponse {
  organizations: AdminOrganization[]
  pagination: PaginationInfo
}

// Alias for backward compatibility
export type OrganizationsResponse = AdminOrganizationsResponse

// ============================================
// Shared Types
// ============================================

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AdminFilters {
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
  page?: number
  limit?: number
}

// ============================================
// Action Types
// ============================================

export interface BanUserInput {
  userId: string
  reason?: string
  expiresAt?: Date | null
}

export interface DeleteUserInput {
  userId: string
  hardDelete?: boolean
}

export interface DeleteOrganizationInput {
  organizationId: string
  hardDelete?: boolean
}

// ============================================
// Platform Admin Types
// ============================================

export interface AdminPlatformAdmin {
  id: string
  userId: string
  tier: "viewer" | "support" | "admin" | "owner"
  grantedBy: string | null
  grantedAt: Date
  notes: string | null
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  grantedByUser: {
    id: string
    name: string | null
    email: string
  } | null
}

export interface PlatformAdminsResponse {
  platformAdmins: AdminPlatformAdmin[]
  pagination: PaginationInfo
}

// ============================================
// Audit Log Types
// ============================================

export interface AdminAuditLogEntry {
  id: string
  adminId: string
  actionType: string
  targetUserId: string | null
  targetOrgId: string | null
  metadata: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  admin: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  targetUser: {
    id: string
    name: string | null
    email: string
  } | null
}

export interface AuditLogResponse {
  logs: AdminAuditLogEntry[]
  pagination: PaginationInfo
}
