# Authentication System

## Overview

Authentication for the PDF annotation editor using [Better Auth](https://www.better-auth.com/) with Nuxt 4, Drizzle ORM, and Neon PostgreSQL. Supports both web (cookie-based) and native app (JWT/Bearer token) authentication strategies.

## Technology Stack

- **Better Auth**: Modern TypeScript authentication framework
- **Drizzle ORM**: Type-safe SQL query builder and schema management
- **Neon**: Serverless PostgreSQL database
- **Nuxt 4**: Server routes and middleware integration

## Installation

```bash
# Core dependencies
pnpm add better-auth

# Database
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit
```

## Configuration

### Environment Variables

```env
# .env
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"  # Production: https://yourapp.com

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

### Nuxt Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only
    databaseUrl: process.env.DATABASE_URL,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    },
    // Public (exposed to client)
    public: {
      betterAuthUrl: process.env.BETTER_AUTH_URL
    }
  }
})
```

## Database Schema

### Drizzle Schema

```typescript
// server/database/schema/auth.ts
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
})

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
})

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
})

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
})
```

### Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./server/database/schema/*",
  out: "./server/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
```

### Database Client

```typescript
// server/utils/db.ts
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "../database/schema/auth"

const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema })

export { schema }
```

## Better Auth Setup

### Auth Configuration

```typescript
// server/utils/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db, schema } from "./db"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications
    }
  }),

  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // Send password reset email
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<a href="${url}">Reset password</a>`
      })
    }
  },

  // Email verification
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<a href="${url}">Verify email</a>`
      })
    }
  },

  // OAuth providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    }
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minutes
    }
  },

  // Advanced options
  advanced: {
    generateId: () => crypto.randomUUID()
  },

  // Plugins (see payment-system.md and native auth)
  plugins: [
    // Added in other feature docs
  ]
})

// Export type for client
export type Auth = typeof auth
```

### API Route Handler

```typescript
// server/api/auth/[...all].ts
import { auth } from "~/server/utils/auth"
import { toWebRequest, fromWebResponse } from "h3-adapter"

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const response = await auth.handler(request)
  return fromWebResponse(event, response)
})
```

## Client Integration

### Auth Client

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/vue"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || ""
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
```

### Auth Composable

```typescript
// composables/useAuth.ts
import { authClient } from "~/lib/auth-client"

export function useAuth() {
  const session = authClient.useSession()

  const user = computed(() => session.value?.data?.user ?? null)
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = computed(() => session.value?.isPending ?? true)

  async function signInWithEmail(email: string, password: string) {
    const result = await authClient.signIn.email({
      email,
      password
    })

    if (result.error) {
      throw new Error(result.error.message)
    }

    return result.data
  }

  async function signInWithGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard"
    })
  }

  async function signInWithGithub() {
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard"
    })
  }

  async function signUpWithEmail(email: string, password: string, name: string) {
    const result = await authClient.signUp.email({
      email,
      password,
      name
    })

    if (result.error) {
      throw new Error(result.error.message)
    }

    return result.data
  }

  async function logout() {
    await authClient.signOut()
    navigateTo("/login")
  }

  async function resetPassword(email: string) {
    const result = await authClient.forgetPassword({
      email,
      redirectTo: "/reset-password"
    })

    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    signInWithEmail,
    signInWithGoogle,
    signInWithGithub,
    signUpWithEmail,
    logout,
    resetPassword
  }
}
```

## Route Protection

### Auth Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, isLoading } = useAuth()

  // Wait for session to load
  if (isLoading.value) {
    // Optionally show loading state
    return
  }

  // Protected routes
  const protectedRoutes = ["/dashboard", "/editor", "/projects"]
  const isProtected = protectedRoutes.some((route) => to.path.startsWith(route))

  if (isProtected && !isAuthenticated.value) {
    return navigateTo(`/login?redirect=${to.fullPath}`)
  }

  // Guest-only routes (login, register)
  const guestRoutes = ["/login", "/register", "/forgot-password"]
  const isGuestOnly = guestRoutes.includes(to.path)

  if (isGuestOnly && isAuthenticated.value) {
    return navigateTo("/dashboard")
  }
})
```

### Server-Side Protection

```typescript
// server/middleware/auth.ts
import { auth } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  // Skip auth routes
  if (event.path.startsWith("/api/auth")) {
    return
  }

  // Protected API routes
  const protectedPaths = ["/api/documents", "/api/projects", "/api/user"]
  const isProtected = protectedPaths.some((path) => event.path.startsWith(path))

  if (isProtected) {
    const session = await auth.api.getSession({
      headers: event.headers
    })

    if (!session) {
      throw createError({
        statusCode: 401,
        message: "Unauthorized"
      })
    }

    // Attach session to event context
    event.context.session = session
    event.context.user = session.user
  }
})
```

### Helper for Protected Routes

```typescript
// server/utils/auth-helpers.ts
import { H3Event } from "h3"

export function requireAuth(event: H3Event) {
  const session = event.context.session

  if (!session) {
    throw createError({
      statusCode: 401,
      message: "Authentication required"
    })
  }

  return session
}

export function requireRole(event: H3Event, roles: string[]) {
  const session = requireAuth(event)

  if (!roles.includes(session.user.role)) {
    throw createError({
      statusCode: 403,
      message: "Insufficient permissions"
    })
  }

  return session
}
```

## User Profile Management

### Update Profile

```typescript
// server/api/user/profile.patch.ts
import { auth } from "~/server/utils/auth"
import { requireAuth } from "~/server/utils/auth-helpers"

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const body = await readBody(event)

  const { name, image } = body

  await auth.api.updateUser({
    body: { name, image },
    headers: event.headers
  })

  return { success: true }
})
```

### Change Password

```typescript
// server/api/user/password.patch.ts
import { auth } from "~/server/utils/auth"
import { requireAuth } from "~/server/utils/auth-helpers"

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = await readBody(event)

  const { currentPassword, newPassword } = body

  const result = await auth.api.changePassword({
    body: { currentPassword, newPassword },
    headers: event.headers
  })

  if (result.error) {
    throw createError({
      statusCode: 400,
      message: result.error.message
    })
  }

  return { success: true }
})
```

## Email Service Integration

```typescript
// server/utils/email.ts
interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  // Using Resend, SendGrid, or other provider
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "noreply@yourapp.com",
      to,
      subject,
      html
    })
  })

  if (!response.ok) {
    throw new Error("Failed to send email")
  }

  return response.json()
}
```

## File Structure

```
server/
   api/
      auth/
         [...all].ts          # Better Auth handler
      user/
          profile.patch.ts     # Update profile
          password.patch.ts    # Change password
   database/
      schema/
         auth.ts              # Drizzle schema
      migrations/              # Generated migrations
   middleware/
      auth.ts                  # Server auth middleware
   utils/
       auth.ts                  # Better Auth config
       auth-helpers.ts          # Helper functions
       db.ts                    # Drizzle client
       email.ts                 # Email service

lib/
   auth-client.ts               # Better Auth client

composables/
   useAuth.ts                   # Auth composable

middleware/
   auth.ts                      # Client route protection
```

## Database Migrations

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Push schema directly (development)
pnpm drizzle-kit push

# Open Drizzle Studio
pnpm drizzle-kit studio
```

## Security Considerations

### Password Requirements

```typescript
// In Better Auth config
emailAndPassword: {
  enabled: true,
  minPasswordLength: 8,
  maxPasswordLength: 128,
  password: {
    // Custom validation
    validate: (password) => {
      if (!/[A-Z]/.test(password)) {
        return 'Password must contain uppercase letter'
      }
      if (!/[0-9]/.test(password)) {
        return 'Password must contain number'
      }
      return true
    }
  }
}
```

### Rate Limiting

```typescript
// server/plugins/rate-limit.ts
import { rateLimit } from "better-auth/plugins"

// Add to auth config plugins
plugins: [
  rateLimit({
    window: 60, // 1 minute
    max: 10, // 10 requests per window
    // Custom per-endpoint limits
    customRules: {
      "/api/auth/sign-in": { window: 300, max: 5 },
      "/api/auth/sign-up": { window: 3600, max: 3 }
    }
  })
]
```

### CSRF Protection

Better Auth includes CSRF protection by default for cookie-based sessions.

## Acceptance Criteria

### Core Authentication

- [ ] Email/password sign up works
- [ ] Email/password sign in works
- [ ] Sign out clears session
- [ ] Email verification flow works
- [ ] Password reset flow works

### OAuth

- [ ] Google OAuth sign in works
- [ ] GitHub OAuth sign in works
- [ ] OAuth account linking works

### Session Management

- [ ] Sessions persist across page refreshes
- [ ] Session expiry works correctly
- [ ] Multiple sessions per user supported
- [ ] Session revocation works

### Route Protection

- [ ] Protected routes redirect to login
- [ ] Guest routes redirect authenticated users
- [ ] API routes require authentication
- [ ] Server middleware validates sessions

### User Management

- [ ] Profile update works
- [ ] Password change works
- [ ] Account deletion works

### Database

- [ ] Drizzle schema matches Better Auth requirements
- [ ] Migrations run successfully
- [ ] Neon connection is stable
- [ ] Connection pooling works

### Security

- [ ] Passwords are hashed (argon2)
- [ ] CSRF protection enabled
- [ ] Rate limiting prevents abuse
- [ ] Secure cookie settings in production
