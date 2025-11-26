# Document Sharing

## Overview

Allow users to generate shareable public links for documents, enabling them to share annotated PDFs with colleagues, clients, or stakeholders without requiring them to have an account.

## Use Cases

- **Client Approval**: Share annotated quote/plan with client for review
- **Team Collaboration**: Quick share with colleague who doesn't have an account
- **Contractor Handoff**: Share marked-up plans with subcontractors
- **Presentation**: Embed or link in proposals/emails

## Share Types

### 1. View-Only Link
- Recipients can view the document and annotations
- Cannot edit or add annotations
- No account required

### 2. Comment Link (Future)
- Recipients can view and add comments
- Cannot edit existing annotations
- Requires email verification

### 3. Collaboration Session
- Full real-time editing (see `collaborative_sessions.md`)
- Requires account or guest session

## Data Model

### Share Link

```typescript
// types/share.ts
interface DocumentShare {
  id: string
  documentId: string
  projectId: string

  // Link configuration
  token: string  // Unique URL token (nanoid)
  slug?: string  // Optional custom slug

  // Access settings
  accessLevel: 'view' | 'comment'
  password?: string  // Optional password protection

  // Expiration
  expiresAt?: Date
  maxViews?: number
  viewCount: number

  // Restrictions
  allowDownload: boolean
  allowPrint: boolean
  watermark?: string  // Overlay watermark text

  // Tracking
  createdBy: string
  createdAt: Date
  lastAccessedAt?: Date

  // Status
  isActive: boolean
  revokedAt?: Date
  revokedBy?: string
}

interface ShareAccess {
  id: string
  shareId: string
  accessedAt: Date
  ipAddress?: string
  userAgent?: string
  referrer?: string
  country?: string
}
```

### Database Schema

```typescript
// server/database/schema/shares.ts
import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core'
import { documents } from './documents'
import { users } from './auth'

export const documentShares = pgTable('document_shares', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),

  // Link
  token: text('token').notNull().unique(),
  slug: text('slug').unique(),

  // Access
  accessLevel: text('access_level').notNull().default('view'),
  passwordHash: text('password_hash'),

  // Limits
  expiresAt: timestamp('expires_at'),
  maxViews: integer('max_views'),
  viewCount: integer('view_count').notNull().default(0),

  // Permissions
  allowDownload: boolean('allow_download').notNull().default(true),
  allowPrint: boolean('allow_print').notNull().default(true),
  watermark: text('watermark'),

  // Metadata
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at'),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  revokedAt: timestamp('revoked_at'),
  revokedBy: text('revoked_by').references(() => users.id)
})

export const shareAccessLog = pgTable('share_access_log', {
  id: text('id').primaryKey(),
  shareId: text('share_id')
    .notNull()
    .references(() => documentShares.id, { onDelete: 'cascade' }),
  accessedAt: timestamp('accessed_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  referrer: text('referrer'),
  country: text('country')
})
```

## URL Structure

```
# Token-based (default)
https://app.example.com/share/abc123xyz

# Custom slug
https://app.example.com/share/project-acme-floorplan

# Password protected (same URL, prompts for password)
https://app.example.com/share/abc123xyz
```

## Implementation

### Create Share Link

```typescript
// server/api/documents/[id]/share.post.ts
import { nanoid } from 'nanoid'
import { hash } from 'argon2'
import { requireAuth } from '~/server/utils/auth-helpers'
import { db, schema } from '~/server/utils/db'

interface CreateShareBody {
  accessLevel?: 'view' | 'comment'
  password?: string
  expiresIn?: number  // hours
  maxViews?: number
  allowDownload?: boolean
  allowPrint?: boolean
  watermark?: string
  slug?: string
}

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const body = await readBody<CreateShareBody>(event)

  // Verify document ownership
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId))

  if (!document || document.ownerId !== session.user.id) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  // Generate unique token
  const token = nanoid(12)

  // Hash password if provided
  const passwordHash = body.password
    ? await hash(body.password)
    : null

  // Calculate expiration
  const expiresAt = body.expiresIn
    ? new Date(Date.now() + body.expiresIn * 60 * 60 * 1000)
    : null

  // Validate custom slug
  if (body.slug) {
    const existing = await db
      .select()
      .from(schema.documentShares)
      .where(eq(schema.documentShares.slug, body.slug))
      .limit(1)

    if (existing.length > 0) {
      throw createError({ statusCode: 400, message: 'Slug already in use' })
    }
  }

  const [share] = await db.insert(schema.documentShares).values({
    id: crypto.randomUUID(),
    documentId,
    token,
    slug: body.slug || null,
    accessLevel: body.accessLevel || 'view',
    passwordHash,
    expiresAt,
    maxViews: body.maxViews || null,
    allowDownload: body.allowDownload ?? true,
    allowPrint: body.allowPrint ?? true,
    watermark: body.watermark || null,
    createdBy: session.user.id
  }).returning()

  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
  const shareUrl = share.slug
    ? `${baseUrl}/share/${share.slug}`
    : `${baseUrl}/share/${share.token}`

  return {
    ...share,
    url: shareUrl,
    passwordProtected: !!passwordHash
  }
})
```

### Access Shared Document

```typescript
// server/api/share/[token].get.ts
import { verify } from 'argon2'
import { db, schema } from '~/server/utils/db'
import { eq, or, and, gt, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const password = getHeader(event, 'x-share-password')

  // Find share by token or slug
  const [share] = await db
    .select()
    .from(schema.documentShares)
    .where(
      and(
        or(
          eq(schema.documentShares.token, token!),
          eq(schema.documentShares.slug, token!)
        ),
        eq(schema.documentShares.isActive, true)
      )
    )

  if (!share) {
    throw createError({ statusCode: 404, message: 'Share link not found' })
  }

  // Check expiration
  if (share.expiresAt && new Date() > share.expiresAt) {
    throw createError({ statusCode: 410, message: 'Share link has expired' })
  }

  // Check view limit
  if (share.maxViews && share.viewCount >= share.maxViews) {
    throw createError({ statusCode: 410, message: 'Share link view limit reached' })
  }

  // Check password
  if (share.passwordHash) {
    if (!password) {
      throw createError({
        statusCode: 401,
        message: 'Password required',
        data: { passwordRequired: true }
      })
    }

    const valid = await verify(share.passwordHash, password)
    if (!valid) {
      throw createError({ statusCode: 401, message: 'Invalid password' })
    }
  }

  // Get document with annotations
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, share.documentId))

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  // Log access
  await db.insert(schema.shareAccessLog).values({
    id: crypto.randomUUID(),
    shareId: share.id,
    ipAddress: getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip'),
    userAgent: getHeader(event, 'user-agent'),
    referrer: getHeader(event, 'referer')
  })

  // Increment view count
  await db
    .update(schema.documentShares)
    .set({
      viewCount: share.viewCount + 1,
      lastAccessedAt: new Date()
    })
    .where(eq(schema.documentShares.id, share.id))

  return {
    document: {
      id: document.id,
      name: document.name,
      // Don't expose internal URLs, use proxy
      pdfUrl: `/api/share/${token}/pdf`
    },
    annotations: document.annotations,
    permissions: {
      canEdit: false,
      canComment: share.accessLevel === 'comment',
      canDownload: share.allowDownload,
      canPrint: share.allowPrint
    },
    watermark: share.watermark
  }
})
```

### Revoke Share Link

```typescript
// server/api/documents/[id]/share/[shareId].delete.ts
import { requireAuth } from '~/server/utils/auth-helpers'
import { db, schema } from '~/server/utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = requireAuth(event)
  const documentId = getRouterParam(event, 'id')
  const shareId = getRouterParam(event, 'shareId')

  // Verify ownership and revoke
  const [share] = await db
    .update(schema.documentShares)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedBy: session.user.id
    })
    .where(
      and(
        eq(schema.documentShares.id, shareId!),
        eq(schema.documentShares.documentId, documentId!)
      )
    )
    .returning()

  if (!share) {
    throw createError({ statusCode: 404, message: 'Share not found' })
  }

  return { success: true }
})
```

## Composables

### useDocumentShare

```typescript
// composables/useDocumentShare.ts
export function useDocumentShare(documentId: string) {
  const shares = ref<DocumentShare[]>([])
  const loading = ref(false)

  async function fetchShares() {
    loading.value = true
    try {
      shares.value = await $fetch(`/api/documents/${documentId}/shares`)
    } finally {
      loading.value = false
    }
  }

  async function createShare(options: CreateShareOptions = {}) {
    const share = await $fetch(`/api/documents/${documentId}/share`, {
      method: 'POST',
      body: options
    })
    shares.value.push(share)
    return share
  }

  async function revokeShare(shareId: string) {
    await $fetch(`/api/documents/${documentId}/share/${shareId}`, {
      method: 'DELETE'
    })
    shares.value = shares.value.filter(s => s.id !== shareId)
  }

  async function copyShareLink(share: DocumentShare) {
    await navigator.clipboard.writeText(share.url)
    toast.success('Link copied to clipboard')
  }

  onMounted(fetchShares)

  return {
    shares,
    loading,
    createShare,
    revokeShare,
    copyShareLink,
    fetchShares
  }
}
```

## UI Components

### Share Dialog

```vue
<!-- components/document/ShareDialog.vue -->
<script setup lang="ts">
const props = defineProps<{
  documentId: string
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { shares, createShare, revokeShare, copyShareLink, loading } = useDocumentShare(props.documentId)

// New share form
const showNewForm = ref(false)
const newShare = ref({
  password: '',
  expiresIn: null as number | null,
  maxViews: null as number | null,
  allowDownload: true,
  allowPrint: true,
  watermark: ''
})
const creating = ref(false)

async function handleCreate() {
  creating.value = true
  try {
    const share = await createShare({
      password: newShare.value.password || undefined,
      expiresIn: newShare.value.expiresIn || undefined,
      maxViews: newShare.value.maxViews || undefined,
      allowDownload: newShare.value.allowDownload,
      allowPrint: newShare.value.allowPrint,
      watermark: newShare.value.watermark || undefined
    })

    await copyShareLink(share)
    showNewForm.value = false

    // Reset form
    newShare.value = {
      password: '',
      expiresIn: null,
      maxViews: null,
      allowDownload: true,
      allowPrint: true,
      watermark: ''
    }
  } finally {
    creating.value = false
  }
}

function formatExpiry(date: Date | null) {
  if (!date) return 'Never'
  return new Date(date).toLocaleDateString()
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Share Document</DialogTitle>
        <DialogDescription>
          Create shareable links for this document
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Existing shares -->
        <div v-if="shares.length" class="space-y-2">
          <div
            v-for="share in shares"
            :key="share.id"
            class="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <Icon
                  :name="share.passwordHash ? 'lock' : 'link'"
                  class="text-muted-foreground"
                  size="16"
                />
                <span class="text-sm font-mono truncate">
                  {{ share.slug || share.token }}
                </span>
              </div>
              <div class="text-xs text-muted-foreground mt-1">
                {{ share.viewCount }} views
                <span v-if="share.maxViews"> / {{ share.maxViews }}</span>
                · Expires: {{ formatExpiry(share.expiresAt) }}
              </div>
            </div>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                @click="copyShareLink(share)"
              >
                <Icon name="copy" size="16" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                @click="revokeShare(share.id)"
              >
                <Icon name="trash" size="16" class="text-destructive" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Create new share -->
        <div v-if="!showNewForm">
          <Button @click="showNewForm = true" class="w-full">
            <Icon name="plus" class="mr-2" />
            Create Share Link
          </Button>
        </div>

        <div v-else class="space-y-4 p-4 border rounded-lg">
          <h4 class="font-medium">New Share Link</h4>

          <!-- Password -->
          <div class="space-y-2">
            <Label>Password Protection (optional)</Label>
            <Input
              v-model="newShare.password"
              type="password"
              placeholder="Leave empty for no password"
            />
          </div>

          <!-- Expiration -->
          <div class="space-y-2">
            <Label>Expires After</Label>
            <Select v-model="newShare.expiresIn">
              <SelectTrigger>
                <SelectValue placeholder="Never" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="null">Never</SelectItem>
                <SelectItem :value="1">1 hour</SelectItem>
                <SelectItem :value="24">24 hours</SelectItem>
                <SelectItem :value="168">7 days</SelectItem>
                <SelectItem :value="720">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Max views -->
          <div class="space-y-2">
            <Label>View Limit</Label>
            <Input
              v-model.number="newShare.maxViews"
              type="number"
              placeholder="Unlimited"
              min="1"
            />
          </div>

          <!-- Permissions -->
          <div class="space-y-2">
            <Label>Permissions</Label>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2">
                <Checkbox v-model:checked="newShare.allowDownload" />
                <span class="text-sm">Allow download</span>
              </label>
              <label class="flex items-center gap-2">
                <Checkbox v-model:checked="newShare.allowPrint" />
                <span class="text-sm">Allow print</span>
              </label>
            </div>
          </div>

          <!-- Watermark -->
          <div class="space-y-2">
            <Label>Watermark Text (optional)</Label>
            <Input
              v-model="newShare.watermark"
              placeholder="e.g., CONFIDENTIAL"
            />
          </div>

          <div class="flex gap-2">
            <Button
              variant="outline"
              @click="showNewForm = false"
              class="flex-1"
            >
              Cancel
            </Button>
            <Button
              @click="handleCreate"
              :loading="creating"
              class="flex-1"
            >
              Create & Copy Link
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
```

### Shared Document Viewer Page

```vue
<!-- pages/share/[token].vue -->
<script setup lang="ts">
const route = useRoute()
const token = route.params.token as string

const password = ref('')
const passwordRequired = ref(false)
const error = ref<string | null>(null)

const { data: shareData, error: fetchError, refresh } = await useFetch(
  `/api/share/${token}`,
  {
    headers: computed(() => ({
      'x-share-password': password.value || undefined
    })),
    immediate: false
  }
)

// Initial fetch
onMounted(async () => {
  try {
    await refresh()
  } catch (e: any) {
    if (e.data?.passwordRequired) {
      passwordRequired.value = true
    } else {
      error.value = e.message
    }
  }
})

async function submitPassword() {
  error.value = null
  try {
    await refresh()
    passwordRequired.value = false
  } catch (e: any) {
    error.value = 'Invalid password'
  }
}

// SEO
useHead({
  title: shareData.value?.document.name || 'Shared Document'
})
</script>

<template>
  <div class="shared-viewer">
    <!-- Password prompt -->
    <div v-if="passwordRequired" class="password-prompt">
      <Card class="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Password Required</CardTitle>
          <CardDescription>
            This document is password protected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="submitPassword" class="space-y-4">
            <Input
              v-model="password"
              type="password"
              placeholder="Enter password"
              autofocus
            />
            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
            <Button type="submit" class="w-full">
              View Document
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <Card class="max-w-md mx-auto mt-20">
        <CardContent class="pt-6 text-center">
          <Icon name="alert-circle" size="48" class="text-destructive mx-auto mb-4" />
          <h2 class="text-xl font-semibold mb-2">Unable to Load Document</h2>
          <p class="text-muted-foreground">{{ error }}</p>
        </CardContent>
      </Card>
    </div>

    <!-- Document viewer -->
    <div v-else-if="shareData" class="viewer-container">
      <!-- Watermark overlay -->
      <div
        v-if="shareData.watermark"
        class="watermark-overlay"
      >
        {{ shareData.watermark }}
      </div>

      <!-- Header -->
      <header class="share-header">
        <h1>{{ shareData.document.name }}</h1>
        <div class="header-actions">
          <Button
            v-if="shareData.permissions.canDownload"
            variant="outline"
            @click="downloadDocument"
          >
            <Icon name="download" class="mr-2" />
            Download
          </Button>
        </div>
      </header>

      <!-- PDF Viewer (read-only) -->
      <EditorPdfViewer
        :pdf-url="shareData.document.pdfUrl"
        :annotations="shareData.annotations"
        :readonly="true"
      />
    </div>
  </div>
</template>

<style scoped>
.watermark-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  font-weight: bold;
  color: rgba(128, 128, 128, 0.15);
  pointer-events: none;
  transform: rotate(-30deg);
  z-index: 100;
}
</style>
```

## Security Considerations

1. **Token Entropy**: Use cryptographically secure random tokens (nanoid 12+ chars)
2. **Password Hashing**: Use argon2 for password protection
3. **Rate Limiting**: Limit password attempts per IP
4. **Access Logging**: Track all access for audit
5. **Revocation**: Immediate effect when share is revoked
6. **No Enumeration**: Return same error for invalid/expired/revoked links

## Acceptance Criteria

### Share Creation
- [ ] Create share link from document
- [ ] Optional password protection
- [ ] Optional expiration time
- [ ] Optional view limit
- [ ] Custom slug support
- [ ] Copy link to clipboard

### Share Access
- [ ] Access document via share link
- [ ] Password prompt when required
- [ ] Expired links show error
- [ ] View limit enforced
- [ ] Access logged

### Permissions
- [ ] View-only by default
- [ ] Download permission toggle
- [ ] Print permission toggle
- [ ] Watermark overlay

### Management
- [ ] List all shares for document
- [ ] View access statistics
- [ ] Revoke share links
- [ ] Edit share settings
