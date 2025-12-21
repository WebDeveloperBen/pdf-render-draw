# Platform Admin Implementation - Audit Report

This report audits the platform admin implementation against project conventions, identifying gaps and enhancements needed.

---

## Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Type Safety | Needs Improvement | 2 issues |
| UI/UX Patterns | Needs Improvement | 3 issues |
| Testing | Missing | 2 issues |
| API Patterns | Minor | 2 issues |
| Feature Completeness | Incomplete | 5 issues |

**Total Issues: 14**

---

## Fixed Issues

### Middleware Session Handling [FIXED]

**Issue**: Admin middleware used `authClient.useSession()` without `useFetch`, causing the route to never load.

**Fix Applied**: Updated `app/middleware/admin.ts` to use `authClient.useSession(useFetch)` matching the pattern in `auth.global.ts`.

---

## 1. Type Safety Issues

### 1.1 No Shared Types File for Admin [HIGH]

**Convention**: Types are defined in `shared/types/*.types.ts` using Drizzle's `InferSelectModel`

**Reference**: `shared/types/projects.types.ts`

**Current State**: Types are defined inline in each admin page (e.g., `UserDetail`, `AdminUser`, `OrgDetail`)

**Impact**: Code duplication, type drift between pages, harder to maintain

**Fix Required**:
```
Create: shared/types/admin.types.ts
```

Should include:
- `AdminUser` - User list item type
- `AdminUserDetail` - Full user with memberships
- `AdminOrganization` - Org list item type
- `AdminOrganizationDetail` - Full org with members
- `AdminStats` - Dashboard statistics
- Infer from Drizzle schema where possible

---

### 1.2 Inconsistent Type Exports from Plugin [MEDIUM]

**Convention**: Types should be consistently exported and accessible

**Current State**: `PlatformAdminTier` had to be re-exported from client plugin

**Fix Required**:
- Create a unified types export at `shared/auth/plugins/index.ts`
- Export all public types from one location

---

## 2. UI/UX Pattern Issues

### 2.1 Forms Not Using FormBuilder [HIGH]

**Convention**: Use `UiFormBuilder` component with field configuration for forms

**Component**: `app/components/ui/FormBuilder/FormBuilder.vue`

**Current State**: Admin dialogs use manual `UiInput`, `UiSelect`, `UiTextarea` without FormBuilder

**Files Affected**:
- `app/pages/(admin)/admin/platform-admins/index.vue` - Grant dialog, Update tier dialog
- `app/pages/(admin)/admin/users/[id].vue` - Ban dialog

**Fix Required**:
```typescript
import type { FormBuilder } from "~/components/ui/FormBuilder/FormBuilder.vue"

const grantFields: FormBuilder[] = [
  {
    variant: "Input",
    name: "userId",
    label: "User ID",
    placeholder: "Enter user ID...",
    required: true
  },
  {
    variant: "Select",
    name: "tier",
    label: "Tier",
    options: [
      { value: "viewer", label: "Viewer - Read-only access" },
      { value: "support", label: "Support - Ban, impersonate, view data" },
      { value: "admin", label: "Admin - Full access" }
    ]
  },
  {
    variant: "Textarea",
    name: "notes",
    label: "Notes (optional)",
    placeholder: "Reason for granting access..."
  }
]

// In template:
<UiFormBuilder :fields="grantFields" />
```

---

### 2.2 User Search Missing in Grant Dialog [MEDIUM]

**Convention**: User-friendly interfaces with search/autocomplete

**Current State**: Grant dialog requires copying exact user ID manually

**Fix Required**:
- Add user search input with autocomplete
- Show user avatar/name when selected
- Validate user exists before submission

---

### 2.3 Missing Loading States on Some Actions [LOW]

**Convention**: Buttons show loading spinner during async operations

**Current State**: Some action buttons don't consistently show loading state

**Files to Review**: All admin pages with async actions

---

## 3. Testing Issues

### 3.1 No Unit Tests for Composable [HIGH]

**Convention**: Composables have colocated `*.spec.ts` files

**Reference**: `app/composables/editor/useKeyboardShortcuts.spec.ts`

**Current State**: `usePermissions.ts` has no tests for the new platform admin functions

**Fix Required**:
```
Create: app/composables/usePermissions.spec.ts
```

Test cases needed:
- `hasPlatformAdminTier()` returns correct boolean for each tier
- `fetchPlatformAdminStatus()` caches results
- `clearPlatformAdminCache()` clears cached state
- Tier level comparisons work correctly

---

### 3.2 No Integration Tests for Admin APIs [MEDIUM]

**Convention**: API endpoints should have tests

**Current State**: No tests for admin API endpoints

**Fix Required**:
```
Create: server/api/admin/__tests__/
```

---

## 4. API Pattern Issues

### 4.1 Missing Error Codes [LOW]

**Convention**: Use consistent error codes across APIs

**Current State**: Some errors use generic messages without codes

**Fix Required**:
- Define admin-specific error codes
- Return structured errors with codes

---

### 4.2 No Rate Limiting on Sensitive Endpoints [LOW]

**Consideration**: Protect sensitive endpoints from abuse

**Current State**: No rate limiting on admin actions like ban, grant, revoke

**Future Enhancement**:
- Add rate limiting to sensitive admin endpoints
- Log failed attempts

---

## 5. Feature Completeness Gaps

### 5.1 Missing Delete User/Organization APIs [HIGH]

**Plan States**: "Admin tier can delete users/orgs"

**Current State**: No delete APIs exist

**Fix Required**:
```
Create: server/api/admin/users/[id].delete.ts
Create: server/api/admin/organizations/[id].delete.ts
```

With:
- Confirmation required
- Cascade handling
- Audit logging

---

### 5.2 Missing Growth Charts [MEDIUM]

**Consideration**: Dashboard could show trends over time

**Current State**: Only stat cards, no charts

**Future Enhancement**:
- Add time-series data endpoint
- Add chart component
- Display user/org growth over time

---

### 5.3 Missing Stop Impersonation UI [MEDIUM]

**Current State**: Can start impersonation but no visible way to stop

**Fix Required**:
- Show impersonation banner when active
- Add "Stop Impersonating" button
- Redirect back to admin panel on stop

---

### 5.4 Incomplete Audit Logging [MEDIUM]

**Plan States**: All admin actions should be logged

**Current State**: Plugin logs grant/revoke/update-tier, but missing:
- Ban/unban user (needs integration with better-auth admin plugin)
- Delete user/org (when implemented)
- Impersonation start/stop

**Fix Required**:
- Add audit logging hooks for better-auth admin actions
- Ensure all admin mutations are logged

---

### 5.5 No Bulk Actions [LOW]

**Consideration**: Common admin pattern for efficiency

**Current State**: Actions must be done one-by-one

**Future Enhancement**:
- Bulk ban/unban
- Bulk delete
- Export data

---

## Priority Implementation Order

### Critical (Before Production)
1. **5.1** - Delete APIs (security: admin capability without implementation)
2. **3.1** - Unit tests for permissions composable
3. **1.1** - Shared types file

### High Priority
4. **2.1** - Use FormBuilder for all admin forms
5. **5.4** - Complete audit logging
6. **5.3** - Stop impersonation UI

### Medium Priority
7. **2.2** - User search in grant dialog
8. **3.2** - API integration tests
9. **5.2** - Growth charts
10. **1.2** - Unified type exports

### Low Priority (Polish)
11. **2.3** - Loading states audit
12. **4.1** - Error codes
13. **4.2** - Rate limiting
14. **5.5** - Bulk actions

---

## Files to Create

| File | Priority | Description |
|------|----------|-------------|
| `shared/types/admin.types.ts` | High | Shared admin types |
| `app/composables/usePermissions.spec.ts` | Critical | Permission tests |
| `server/api/admin/users/[id].delete.ts` | Critical | Delete user API |
| `server/api/admin/organizations/[id].delete.ts` | Critical | Delete org API |
| `app/components/Admin/ImpersonationBanner.vue` | High | Show when impersonating |
| `app/components/Admin/UserSearch.vue` | Medium | User search component |

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/pages/(admin)/admin/platform-admins/index.vue` | Use FormBuilder for dialogs |
| `app/pages/(admin)/admin/users/[id].vue` | Use FormBuilder for ban dialog |
| `app/layouts/admin.vue` | Add impersonation banner |
| `shared/auth/plugins/platform-admin.ts` | Add more audit logging |

---

## Conclusion

The core platform admin system is functional. The middleware issue preventing `/admin` from loading has been fixed. The main remaining gaps are:

1. **Missing critical features** - Delete APIs mentioned in capabilities but not implemented
2. **Type organization** - Types scattered in pages instead of shared location
3. **Form pattern** - Should use FormBuilder component instead of manual inputs
4. **Testing** - No tests for the new functionality

Addressing the Critical and High Priority items should be done before considering the implementation complete.
