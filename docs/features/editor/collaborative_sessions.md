# Collaborative Editing Sessions (CRDT)

## Overview

Enable real-time multi-user collaboration on PDF annotations using Conflict-free Replicated Data Types (CRDTs). Multiple users can simultaneously view and edit annotations on the same document with automatic conflict resolution and offline support.

## Core Concepts

### Why CRDTs?

- **Conflict-free**: No merge conflicts - all operations automatically converge
- **Offline-first**: Users can work offline and sync when reconnected
- **Real-time**: Sub-second synchronization between participants
- **Decentralized**: No single point of failure for conflict resolution

### Collaboration Model

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   User A    │────▶│   Sync Server   │◀────│   User B    │
│  (Browser)  │◀────│   (WebSocket)   │────▶│  (Browser)  │
└─────────────┘     └─────────────────┘     └─────────────┘
       │                    │                      │
       ▼                    ▼                      ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│ Local CRDT  │     │  Persistence    │     │ Local CRDT  │
│   Store     │     │   (Database)    │     │   Store     │
└─────────────┘     └─────────────────┘     └─────────────┘
```

## Technology Stack

### Recommended: Yjs

- **Library**: [Yjs](https://yjs.dev/) - High-performance CRDT implementation
- **Transport**: WebSocket via `y-websocket` or `y-webrtc` for P2P
- **Persistence**: `y-indexeddb` for local, server-side for shared state
- **Awareness**: Built-in presence/cursor tracking

### Alternative: Automerge

- More Rust-friendly if using Tauri backend
- Slightly different API but similar capabilities

## Data Structures

### Annotation Document (Y.Doc)

```typescript
// types/collaboration.ts
import * as Y from 'yjs'

interface CollaborativeDocument {
  // Yjs document containing all shared state
  doc: Y.Doc

  // Shared annotation map: annotationId -> Annotation
  annotations: Y.Map<Annotation>

  // Undo manager for collaborative undo/redo
  undoManager: Y.UndoManager

  // Awareness for presence (cursors, selections)
  awareness: Awareness
}

interface Annotation {
  id: string
  type: ToolType
  points: Y.Array<Point>
  properties: Y.Map<any>
  createdBy: string
  createdAt: number
  modifiedBy: string
  modifiedAt: number
}
```

### Awareness State (Presence)

```typescript
interface AwarenessState {
  // User identity
  user: {
    id: string
    name: string
    color: string  // Assigned cursor/selection color
    avatar?: string
  }

  // Current state
  cursor?: {
    x: number
    y: number
    page: number
  }

  // What they're doing
  activeTool?: ToolType
  selectedAnnotations?: string[]

  // Viewport (for "follow" feature)
  viewport?: {
    page: number
    zoom: number
    pan: { x: number; y: number }
  }
}
```

## Session Management

### Session Lifecycle

```typescript
interface CollaborationSession {
  // Session metadata
  id: string
  documentId: string
  createdAt: Date
  createdBy: string

  // Access control
  accessLevel: 'view' | 'comment' | 'edit'
  shareLink?: string
  password?: string
  expiresAt?: Date

  // Participants
  participants: SessionParticipant[]
  maxParticipants: number

  // State
  status: 'active' | 'paused' | 'ended'
}

interface SessionParticipant {
  userId: string
  userName: string
  joinedAt: Date
  role: 'owner' | 'editor' | 'viewer'
  isOnline: boolean
  lastSeen: Date
}
```

### Creating a Session

```typescript
// composables/useCollaboration.ts
export function useCollaboration() {
  const session = ref<CollaborationSession | null>(null)
  const ydoc = ref<Y.Doc | null>(null)
  const provider = ref<WebsocketProvider | null>(null)
  const awareness = ref<Awareness | null>(null)

  async function createSession(documentId: string): Promise<string> {
    // Generate session ID
    const sessionId = generateSessionId()

    // Create Yjs document
    ydoc.value = new Y.Doc()

    // Connect to sync server
    provider.value = new WebsocketProvider(
      'wss://sync.yourapp.com',
      sessionId,
      ydoc.value
    )

    // Set up awareness
    awareness.value = provider.value.awareness
    awareness.value.setLocalState({
      user: getCurrentUser(),
      cursor: null,
      activeTool: null
    })

    // Initialize session on server
    await $fetch('/api/collaboration/sessions', {
      method: 'POST',
      body: { documentId, sessionId }
    })

    return sessionId
  }

  async function joinSession(sessionId: string): Promise<void> {
    // Connect to existing session
    ydoc.value = new Y.Doc()

    provider.value = new WebsocketProvider(
      'wss://sync.yourapp.com',
      sessionId,
      ydoc.value
    )

    // Wait for sync
    await new Promise<void>((resolve) => {
      provider.value!.on('synced', () => resolve())
    })

    // Set local awareness
    awareness.value = provider.value.awareness
    awareness.value.setLocalState({
      user: getCurrentUser(),
      cursor: null,
      activeTool: null
    })
  }

  function leaveSession(): void {
    awareness.value?.setLocalState(null)
    provider.value?.disconnect()
    ydoc.value?.destroy()

    session.value = null
    ydoc.value = null
    provider.value = null
    awareness.value = null
  }

  return {
    session,
    ydoc,
    awareness,
    createSession,
    joinSession,
    leaveSession
  }
}
```

## Annotation Synchronization

### Integrating with Annotation Store

```typescript
// composables/useCollaborativeAnnotations.ts
export function useCollaborativeAnnotations() {
  const { ydoc, awareness } = useCollaboration()
  const annotationStore = useAnnotationStore()

  // Shared Yjs map for annotations
  const yAnnotations = computed(() =>
    ydoc.value?.getMap<Annotation>('annotations')
  )

  // Sync Yjs -> Local Store
  watch(yAnnotations, (yMap) => {
    if (!yMap) return

    yMap.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const annotation = yMap.get(key)
          if (annotation) {
            annotationStore.upsertAnnotation(annotation)
          }
        } else if (change.action === 'delete') {
          annotationStore.removeAnnotation(key)
        }
      })
    })
  })

  // Local operations -> Yjs
  function addAnnotation(annotation: Annotation): void {
    if (!yAnnotations.value) return

    ydoc.value?.transact(() => {
      yAnnotations.value!.set(annotation.id, {
        ...annotation,
        createdBy: getCurrentUserId(),
        createdAt: Date.now()
      })
    })
  }

  function updateAnnotation(id: string, updates: Partial<Annotation>): void {
    if (!yAnnotations.value) return

    ydoc.value?.transact(() => {
      const existing = yAnnotations.value!.get(id)
      if (existing) {
        yAnnotations.value!.set(id, {
          ...existing,
          ...updates,
          modifiedBy: getCurrentUserId(),
          modifiedAt: Date.now()
        })
      }
    })
  }

  function deleteAnnotation(id: string): void {
    yAnnotations.value?.delete(id)
  }

  return {
    addAnnotation,
    updateAnnotation,
    deleteAnnotation
  }
}
```

### Point-Based Annotation Sync (Drawing)

```typescript
// For real-time drawing sync (lines, areas, perimeters)
function syncDrawingPoints(annotationId: string) {
  const yPoints = ydoc.value?.getArray<Point>(`points:${annotationId}`)

  // As user draws, push points to Yjs array
  function addPoint(point: Point): void {
    yPoints?.push([point])
  }

  // Other users see points appear in real-time
  yPoints?.observe((event) => {
    // Update local preview with new points
    event.changes.delta.forEach((change) => {
      if (change.insert) {
        renderNewPoints(change.insert as Point[])
      }
    })
  })

  return { addPoint }
}
```

## Presence & Cursors

### Remote Cursor Display

```vue
<!-- components/Editor/RemoteCursors.vue -->
<script setup lang="ts">
const { awareness } = useCollaboration()
const remoteCursors = ref<Map<number, AwarenessState>>(new Map())

// Subscribe to awareness changes
onMounted(() => {
  awareness.value?.on('change', () => {
    const states = awareness.value!.getStates()
    remoteCursors.value = new Map(
      [...states.entries()].filter(([clientId]) =>
        clientId !== awareness.value!.clientID
      )
    )
  })
})

// Update local cursor position
function updateCursor(x: number, y: number, page: number): void {
  awareness.value?.setLocalStateField('cursor', { x, y, page })
}
</script>

<template>
  <g class="remote-cursors">
    <g
      v-for="[clientId, state] in remoteCursors"
      :key="clientId"
      class="remote-cursor"
      :style="{ '--cursor-color': state.user.color }"
    >
      <!-- Cursor pointer -->
      <path
        v-if="state.cursor"
        :d="cursorPath"
        :transform="`translate(${state.cursor.x}, ${state.cursor.y})`"
        :fill="state.user.color"
      />

      <!-- User name label -->
      <g
        v-if="state.cursor"
        :transform="`translate(${state.cursor.x + 12}, ${state.cursor.y + 20})`"
      >
        <rect
          :width="state.user.name.length * 8 + 12"
          height="20"
          rx="4"
          :fill="state.user.color"
        />
        <text
          x="6"
          y="14"
          fill="white"
          font-size="12"
        >
          {{ state.user.name }}
        </text>
      </g>
    </g>
  </g>
</template>

<style scoped>
.remote-cursor {
  pointer-events: none;
  transition: transform 50ms ease-out;
}
</style>
```

### Selection Highlighting

```vue
<!-- Show what other users have selected -->
<template>
  <g class="remote-selections">
    <rect
      v-for="[clientId, state] in remoteCursors"
      v-if="state.selectedAnnotations?.length"
      :key="`selection-${clientId}`"
      v-for="annotationId in state.selectedAnnotations"
      :...getAnnotationBounds(annotationId)"
      :stroke="state.user.color"
      stroke-width="2"
      stroke-dasharray="4,4"
      fill="none"
      class="remote-selection"
    />
  </g>
</template>
```

## Conflict Resolution

### Automatic Resolution (CRDT)

CRDTs handle most conflicts automatically:

| Conflict Type | Resolution |
|---------------|------------|
| Concurrent edits to same annotation | Last-write-wins with vector clocks |
| Concurrent deletes | Delete wins (tombstone) |
| Add + Delete same ID | Delete wins |
| Move same annotation | Both moves applied sequentially |

### Application-Level Locking (Optional)

```typescript
// Optional: Soft locks to prevent editing collisions
interface AnnotationLock {
  annotationId: string
  lockedBy: string
  lockedAt: number
  expiresAt: number
}

function requestLock(annotationId: string): boolean {
  const yLocks = ydoc.value?.getMap<AnnotationLock>('locks')
  const existing = yLocks?.get(annotationId)

  // Check if locked by someone else
  if (existing && existing.lockedBy !== getCurrentUserId()) {
    if (Date.now() < existing.expiresAt) {
      return false // Already locked
    }
  }

  // Acquire lock
  yLocks?.set(annotationId, {
    annotationId,
    lockedBy: getCurrentUserId(),
    lockedAt: Date.now(),
    expiresAt: Date.now() + 30000 // 30 second lock
  })

  return true
}

function releaseLock(annotationId: string): void {
  const yLocks = ydoc.value?.getMap<AnnotationLock>('locks')
  const existing = yLocks?.get(annotationId)

  if (existing?.lockedBy === getCurrentUserId()) {
    yLocks?.delete(annotationId)
  }
}
```

## Undo/Redo

### Collaborative Undo Manager

```typescript
// Each user has their own undo stack
function setupUndoManager() {
  const yAnnotations = ydoc.value?.getMap('annotations')

  const undoManager = new Y.UndoManager(yAnnotations!, {
    // Only track changes made by this user
    trackedOrigins: new Set([ydoc.value!.clientID])
  })

  // Keyboard shortcuts
  useEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoManager.undo()
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        undoManager.redo()
      }
    }
  })

  return undoManager
}
```

## Server Infrastructure

### WebSocket Sync Server

```typescript
// server/api/collaboration/ws.ts (Nitro WebSocket)
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'

export default defineWebSocketHandler({
  open(peer) {
    // Authenticate user
    const token = peer.url.searchParams.get('token')
    const user = await verifyToken(token)

    if (!user) {
      peer.close(4001, 'Unauthorized')
      return
    }

    // Set up Yjs WebSocket connection
    setupWSConnection(peer, peer.request, {
      docName: peer.url.searchParams.get('session')
    })
  },

  message(peer, message) {
    // Handled by y-websocket
  },

  close(peer) {
    // Cleanup handled by y-websocket
  }
})
```

### Session Persistence

```typescript
// server/api/collaboration/sessions/[id].ts
import * as Y from 'yjs'
import { LeveldbPersistence } from 'y-leveldb'

const persistence = new LeveldbPersistence('./yjs-docs')

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')

  if (event.method === 'GET') {
    // Load persisted document state
    const ydoc = await persistence.getYDoc(sessionId)
    const state = Y.encodeStateAsUpdate(ydoc)

    return {
      sessionId,
      state: Buffer.from(state).toString('base64')
    }
  }

  if (event.method === 'DELETE') {
    // End session and archive
    await persistence.clearDocument(sessionId)
    return { success: true }
  }
})
```

## UI Components

### Collaboration Panel

```vue
<!-- components/Editor/CollaborationPanel.vue -->
<script setup lang="ts">
const { session, awareness } = useCollaboration()
const participants = computed(() => {
  const states = awareness.value?.getStates() ?? new Map()
  return [...states.values()].map(s => s.user)
})

const shareLink = computed(() =>
  `${window.location.origin}/editor/${session.value?.documentId}?session=${session.value?.id}`
)

async function copyShareLink() {
  await navigator.clipboard.writeText(shareLink.value)
  toast.success('Link copied!')
}
</script>

<template>
  <div class="collaboration-panel">
    <!-- Active participants -->
    <div class="participants">
      <div class="participant-avatars">
        <Avatar
          v-for="user in participants.slice(0, 5)"
          :key="user.id"
          :src="user.avatar"
          :fallback="user.name[0]"
          :style="{ borderColor: user.color }"
          class="participant-avatar"
        />
        <span v-if="participants.length > 5" class="more-count">
          +{{ participants.length - 5 }}
        </span>
      </div>
    </div>

    <!-- Share controls -->
    <div class="share-controls">
      <Button variant="outline" size="sm" @click="copyShareLink">
        <Icon name="link" class="mr-2" />
        Copy Link
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon">
            <Icon name="settings" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem @click="endSession">
            End Session
          </DropdownMenuItem>
          <DropdownMenuItem @click="exportDocument">
            Export Document
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
```

### Follow Mode

```typescript
// Follow another user's viewport
function followUser(userId: string) {
  const { awareness } = useCollaboration()
  const viewportStore = useViewportStore()

  const followingUser = ref<string | null>(userId)

  watch(
    () => awareness.value?.getStates(),
    (states) => {
      if (!followingUser.value || !states) return

      const targetState = [...states.values()].find(
        s => s.user.id === followingUser.value
      )

      if (targetState?.viewport) {
        viewportStore.setPage(targetState.viewport.page)
        viewportStore.setZoom(targetState.viewport.zoom)
        viewportStore.setPan(targetState.viewport.pan)
      }
    }
  )

  return {
    followingUser,
    stopFollowing: () => { followingUser.value = null }
  }
}
```

## Offline Support

### IndexedDB Persistence

```typescript
// composables/useOfflineSync.ts
import { IndexeddbPersistence } from 'y-indexeddb'

export function useOfflineSync(sessionId: string, ydoc: Y.Doc) {
  const isOnline = useOnline()
  const pendingChanges = ref(0)

  // Persist locally
  const indexeddbProvider = new IndexeddbPersistence(sessionId, ydoc)

  // Track offline changes
  ydoc.on('update', () => {
    if (!isOnline.value) {
      pendingChanges.value++
    }
  })

  // Sync when back online
  watch(isOnline, (online) => {
    if (online && pendingChanges.value > 0) {
      toast.info(`Syncing ${pendingChanges.value} changes...`)
      // y-websocket handles sync automatically
      pendingChanges.value = 0
    }
  })

  return { pendingChanges, isOnline }
}
```

## Permissions & Access Control

### Role-Based Access

```typescript
interface SessionPermissions {
  canView: boolean
  canComment: boolean
  canEdit: boolean
  canDelete: boolean
  canInvite: boolean
  canManageSession: boolean
}

function getPermissions(role: SessionParticipant['role']): SessionPermissions {
  switch (role) {
    case 'owner':
      return {
        canView: true,
        canComment: true,
        canEdit: true,
        canDelete: true,
        canInvite: true,
        canManageSession: true
      }
    case 'editor':
      return {
        canView: true,
        canComment: true,
        canEdit: true,
        canDelete: false,
        canInvite: false,
        canManageSession: false
      }
    case 'viewer':
      return {
        canView: true,
        canComment: false,
        canEdit: false,
        canDelete: false,
        canInvite: false,
        canManageSession: false
      }
  }
}
```

## Files to Create

### New Files

- `composables/useCollaboration.ts` - Core collaboration composable
- `composables/useCollaborativeAnnotations.ts` - Annotation sync
- `composables/useOfflineSync.ts` - Offline support
- `components/Editor/RemoteCursors.vue` - Remote cursor display
- `components/Editor/CollaborationPanel.vue` - Session UI
- `components/Editor/ParticipantList.vue` - User list
- `server/api/collaboration/sessions.post.ts` - Create session
- `server/api/collaboration/sessions/[id].ts` - Session CRUD
- `server/api/collaboration/ws.ts` - WebSocket handler
- `server/utils/yjs-persistence.ts` - Yjs storage
- `types/collaboration.ts` - TypeScript interfaces

### Files to Modify

- `stores/annotations.ts` - Integrate CRDT sync
- `components/Editor/AnnotationLayer.vue` - Add remote cursors
- `components/Editor/index.vue` - Add collaboration panel

## Acceptance Criteria

### Session Management
- [ ] Create new collaboration session
- [ ] Generate shareable invite link
- [ ] Join existing session via link
- [ ] Leave session gracefully
- [ ] End session (owner only)
- [ ] Session persists across page refreshes

### Real-Time Sync
- [ ] Annotations sync between users in <100ms
- [ ] Drawing points sync in real-time
- [ ] Deletions sync correctly
- [ ] No data loss on concurrent edits
- [ ] Undo/redo works per-user

### Presence
- [ ] See other users' cursors
- [ ] See other users' selections
- [ ] See who's in the session
- [ ] See user online/offline status
- [ ] Follow another user's viewport

### Offline Support
- [ ] Work offline with local persistence
- [ ] Auto-sync when reconnected
- [ ] Show pending changes indicator
- [ ] No data loss during disconnection

### Access Control
- [ ] Owner, editor, viewer roles
- [ ] Viewers cannot edit
- [ ] Only owner can end session
- [ ] Invite permissions work correctly

### Performance
- [ ] Handles 10+ concurrent users
- [ ] No noticeable lag with 1000+ annotations
- [ ] Efficient bandwidth usage
- [ ] Memory-efficient on long sessions
