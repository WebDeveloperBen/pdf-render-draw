/**
 * Unified exports for platform admin plugin types and utilities
 */

// Server-side plugin and utilities
export { platformAdminPlugin, hasTier, TIER_LEVELS } from "./platform-admin"
export type { PlatformAdminTier } from "./platform-admin"

// Client-side plugin and types
export { platformAdminClient } from "./platform-admin.client"
export type {
  PlatformAdminStatus,
  PlatformAdminUser,
  PlatformAdminListItem,
  AuditLogEntry,
  UseFetchReturn
} from "./platform-admin.client"
