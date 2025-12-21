# Role Systems Architecture

This document explains the three role systems in the application and how they interact.

## Overview

The application has three distinct role/permission systems:

| System | Scope | Storage | Purpose |
|--------|-------|---------|---------|
| Platform Admin (better-auth) | Global | `user.role` field | better-auth admin plugin authorization |
| Platform Admin Tiers | Global | `platform_admin` table | Tiered platform administration |
| Organization Roles | Per-org | `member.role` field | Organization-level permissions |

## 1. Platform Admin (better-auth compatibility)

**Location:** `user.role` field in user table

**Values:** `"platform_admin"` or `"user"` (default)

**Purpose:** The better-auth admin plugin checks this field to authorize admin operations like:
- Impersonating users
- Banning/unbanning users
- Listing all users
- Revoking sessions

**Configuration:** In `auth.ts`:
```typescript
admin({
  adminRoles: ["platform_admin"],
  // ...
})
```

## 2. Platform Admin Tiers (Custom)

**Location:** `platform_admin` table

**Schema:**
```typescript
{
  id: string
  userId: string        // FK to user
  tier: string          // "owner" | "admin" | "support" | "viewer"
  grantedBy: string     // FK to user who granted
  grantedAt: Date
  notes: string | null
}
```

**Tier Hierarchy:**
| Tier | Level | Capabilities |
|------|-------|--------------|
| `viewer` | 1 | Read-only dashboards, audit logs |
| `support` | 2 | + Impersonate users, ban/unban |
| `admin` | 3 | + Delete users/orgs, full platform access |
| `owner` | 4 | + Manage platform admins (only one owner) |

**Why a separate table?**
- Tracks who granted access and when (audit trail)
- Supports notes/reasons for granting
- Enables tiered permissions beyond binary admin/not-admin
- Cleaner separation from better-auth's role system

## 3. Organization Roles

**Location:** `member.role` field in member table

**Values:** `"owner"` | `"admin"` | `"member"`

**Scope:** Per-organization. A user can have different roles in different organizations.

**Purpose:** Controls what users can do within a specific organization:
- `owner` - Full control, can delete org, manage billing
- `admin` - Manage members, invitations, settings
- `member` - Basic access, view/edit projects

## How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                        Platform Level                        │
├─────────────────────────────────────────────────────────────┤
│  user.role = "platform_admin"  ←──┐                         │
│         ↓                         │  Kept in sync via       │
│  better-auth admin plugin         │  grant/revoke endpoints │
│  (impersonate, ban, etc.)         │                         │
│                                   │                         │
│  platform_admin table ────────────┘                         │
│  (tier, grantedBy, notes)                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Platform admins can manage
                              │ all organizations
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Organization Level                        │
├─────────────────────────────────────────────────────────────┤
│  member.role (per org)                                      │
│  - User A is "admin" in Org 1                               │
│  - User A is "member" in Org 2                              │
│  - User B is "owner" in Org 2                               │
└─────────────────────────────────────────────────────────────┘
```

## The Redundancy

There is intentional redundancy between `user.role` and `platform_admin` table:

- **`platform_admin` table** is the source of truth for tiered admin access
- **`user.role`** is a "flag" required for better-auth admin plugin compatibility

### Sync Mechanism

The `platform-admin.ts` plugin keeps them in sync:

```typescript
// When granting platform admin
await ctx.context.adapter.create({ model: "platform_admin", ... })
await ctx.context.adapter.update({
  model: "user",
  update: { role: "platform_admin" }
})

// When revoking platform admin
await ctx.context.adapter.delete({ model: "platform_admin", ... })
await ctx.context.adapter.update({
  model: "user",
  update: { role: "user" }
})
```

### Why Not Just Use One?

| Approach | Problem |
|----------|---------|
| Only `user.role` | Loses tier system, audit trail, grantedBy tracking |
| Only `platform_admin` table | better-auth admin plugin won't recognize admins |

The current approach accepts minimal redundancy for maximum functionality.

## Key Files

| File | Purpose |
|------|---------|
| `auth.ts` | better-auth config with admin plugin |
| `shared/auth/plugins/platform-admin.ts` | Custom platform admin plugin with tiers |
| `shared/auth/plugins/platform-admin.client.ts` | Client-side platform admin methods |
| `shared/db/schema/better-auth/user.ts` | User table with role field |
| `shared/db/schema/better-auth/platform-admin.ts` | Platform admin table schema |
| `shared/db/schema/better-auth/member.ts` | Organization membership with roles |
| `app/composables/usePermissions.ts` | Frontend permission checks |
| `app/composables/useActiveOrganization.ts` | Organization role checks |

## Checking Permissions

### Platform Admin (Frontend)
```typescript
const { isPlatformAdmin, hasPlatformAdminTier } = usePermissions()

if (hasPlatformAdminTier("support")) {
  // Can impersonate, ban users
}
```

### Organization Role (Frontend)
```typescript
const { isOrgAdmin, isOrgOwner } = useActiveOrganization()

if (isOrgAdmin) {
  // Can manage org members
}
```

### Platform Admin (Backend)
```typescript
// Check platform_admin table
const admin = await db.query.platform_admin.findFirst({
  where: eq(platform_admin.userId, userId)
})
if (admin && hasTier(admin.tier, "support")) {
  // Authorized
}
```
