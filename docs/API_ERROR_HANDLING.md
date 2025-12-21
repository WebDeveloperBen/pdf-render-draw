# API Error Handling

This document outlines the error handling patterns used in the API layer and recommended improvements.

## Overview

The API uses H3 (Nuxt's HTTP layer) for error handling. Key behaviors:

| Environment | Stack Traces | Error Details |
|-------------|--------------|---------------|
| Development | Visible in response | Full Zod errors shown |
| Production | Hidden | Sanitized messages only |

## Current Patterns

### Authentication Errors

All authenticated endpoints follow this pattern:

```typescript
const session = await auth.api.getSession({ headers: event.headers })
if (!session) {
  throw createError({
    statusCode: 401,
    statusMessage: "Unauthorized"
  })
}
```

### Validation Errors

Zod schemas validate request bodies:

```typescript
const bodySchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).nullish()
})

const body = await readValidatedBody(event, bodySchema.parse)
```

### Resource Access Errors

```typescript
// 404 - Resource not found
if (!existingProject) {
  throw createError({
    statusCode: 404,
    statusMessage: "Project not found"
  })
}

// 403 - Access denied
if (existingProject.organizationId !== activeOrgId) {
  throw createError({
    statusCode: 403,
    statusMessage: "Access denied"
  })
}
```

### Permission Checks

Permission utilities in `server/utils/permissions.ts` throw appropriate errors:

```typescript
await requirePlatformAdmin(event) // Throws 403 if not admin
await requireProjectAccess(event, projectId) // Throws 403/404
```

## Global Error Handler

A Nitro plugin (`server/plugins/error-handler.ts`) provides:

1. **Structured logging** - All errors logged to console for OTel capture
2. **Zod error parsing** - Converts validation errors to user-friendly messages

### Error Response Format

Validation errors return a structured response:

```json
{
  "statusCode": 400,
  "statusMessage": "Validation Error",
  "data": {
    "type": "VALIDATION_ERROR",
    "message": "description: Invalid input, expected string",
    "fields": [
      { "field": "description", "message": "Invalid input, expected string" }
    ]
  }
}
```

## Identified Gaps & Improvements

| Gap | Impact | Priority | Status |
|-----|--------|----------|--------|
| No global error handler | Generic 500s | High | **Fixed** |
| Zod errors not parsed | Confusing messages | High | **Fixed** |
| Limited try-catch | DB failures crash | Medium | TODO |
| No structured responses | Clients can't parse | Medium | Partial |
| No rate limiting | DoS risk | Low | TODO |

## Recommended Improvements

### Priority 1: Wrap External Service Calls

```typescript
// Pattern for external service calls
try {
  await deleteFromR2(url)
} catch (error) {
  console.error("R2 deletion failed:", error)
  // Decide: fail silently or throw
}
```

### Priority 2: Database Error Handling

```typescript
try {
  await db.insert(table).values(data)
} catch (error) {
  console.error("Database error:", error)
  throw createError({
    statusCode: 500,
    statusMessage: "Failed to save data. Please try again."
  })
}
```

### Priority 3: Rate Limiting

Consider adding rate limiting via:
- Cloudflare Rate Limiting (if using CF)
- Nitro middleware
- Redis-based limiter for serverless

## Error Status Codes

| Code | Usage |
|------|-------|
| 400 | Validation errors, missing required fields |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 410 | Resource expired (e.g., share links) |
| 500 | Server errors, external service failures |

## Client-Side Error Handling

Use the error response structure in your frontend:

```typescript
try {
  await $fetch("/api/projects", { method: "POST", body })
} catch (error) {
  if (error.data?.type === "VALIDATION_ERROR") {
    // Show field-specific errors
    error.data.fields.forEach(({ field, message }) => {
      setFieldError(field, message)
    })
  } else {
    toast.error(error.statusMessage || "Something went wrong")
  }
}
```
