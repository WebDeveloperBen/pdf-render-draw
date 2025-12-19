<script setup lang="ts">
import { toast } from "vue-sonner"

const session = authClient.useSession()

useSeoMeta({ title: "Security Settings" })

// Password change state
const isChangingPassword = ref(false)
const currentPassword = ref("")
const newPassword = ref("")
const confirmPassword = ref("")

// Sessions state
const sessions = ref<any[]>([])
const isLoadingSessions = ref(false)
const isRevokingSession = ref<string | null>(null)

// Fetch sessions
const fetchSessions = async () => {
  isLoadingSessions.value = true
  try {
    const result = await authClient.listSessions()
    if (result.data) {
      sessions.value = result.data
    }
  } catch (error: any) {
    toast.error("Failed to load sessions")
  } finally {
    isLoadingSessions.value = false
  }
}

// Change password
const handleChangePassword = async () => {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.error("All password fields are required")
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.error("New passwords do not match")
    return
  }

  if (newPassword.value.length < 8) {
    toast.error("Password must be at least 8 characters")
    return
  }

  isChangingPassword.value = true
  try {
    await authClient.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    })

    toast.success("Password changed successfully")
    currentPassword.value = ""
    newPassword.value = ""
    confirmPassword.value = ""
  } catch (error: any) {
    toast.error(error.message || "Failed to change password")
  } finally {
    isChangingPassword.value = false
  }
}

// Revoke session
const handleRevokeSession = async (sessionToken: string) => {
  isRevokingSession.value = sessionToken
  try {
    await authClient.revokeSession({ token: sessionToken })
    sessions.value = sessions.value.filter((s) => s.token !== sessionToken)
    toast.success("Session revoked")
  } catch (error: any) {
    toast.error(error.message || "Failed to revoke session")
  } finally {
    isRevokingSession.value = null
  }
}

// Revoke all other sessions
const handleRevokeAllSessions = async () => {
  try {
    await authClient.revokeOtherSessions()
    await fetchSessions()
    toast.success("All other sessions revoked")
  } catch (error: any) {
    toast.error(error.message || "Failed to revoke sessions")
  }
}

// Format date
const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

// Parse user agent
const parseUserAgent = (ua: string | null) => {
  if (!ua) return { browser: "Unknown", os: "Unknown" }

  let browser = "Unknown"
  let os = "Unknown"

  if (ua.includes("Chrome")) browser = "Chrome"
  else if (ua.includes("Firefox")) browser = "Firefox"
  else if (ua.includes("Safari")) browser = "Safari"
  else if (ua.includes("Edge")) browser = "Edge"

  if (ua.includes("Windows")) os = "Windows"
  else if (ua.includes("Mac")) os = "macOS"
  else if (ua.includes("Linux")) os = "Linux"
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS"
  else if (ua.includes("Android")) os = "Android"

  return { browser, os }
}

// Check if session is current
const isCurrentSession = (sessionToken: string) => {
  return session.value?.data?.session?.token === sessionToken
}

onMounted(() => {
  fetchSessions()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <UiButton variant="ghost" size="icon" to="/settings">
        <Icon name="lucide:arrow-left" class="size-4" />
      </UiButton>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Security</h1>
        <p class="text-muted-foreground">Manage your password and active sessions</p>
      </div>
    </div>

    <!-- Change Password -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Change Password</UiCardTitle>
        <UiCardDescription>Update your password to keep your account secure</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="space-y-2">
          <UiLabel for="currentPassword">Current Password</UiLabel>
          <UiInput
            id="currentPassword"
            v-model="currentPassword"
            type="password"
            placeholder="Enter current password"
            :disabled="isChangingPassword"
          />
        </div>
        <div class="space-y-2">
          <UiLabel for="newPassword">New Password</UiLabel>
          <UiInput
            id="newPassword"
            v-model="newPassword"
            type="password"
            placeholder="Enter new password"
            :disabled="isChangingPassword"
          />
        </div>
        <div class="space-y-2">
          <UiLabel for="confirmPassword">Confirm New Password</UiLabel>
          <UiInput
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            :disabled="isChangingPassword"
            @keyup.enter="handleChangePassword"
          />
        </div>
      </UiCardContent>
      <UiCardFooter>
        <UiButton
          :disabled="isChangingPassword || !currentPassword || !newPassword || !confirmPassword"
          @click="handleChangePassword"
        >
          <Icon v-if="isChangingPassword" name="svg-spinners:ring-resize" class="size-4" />
          Change Password
        </UiButton>
      </UiCardFooter>
    </UiCard>

    <!-- Active Sessions -->
    <UiCard>
      <UiCardHeader>
        <div class="flex items-center justify-between">
          <div>
            <UiCardTitle>Active Sessions</UiCardTitle>
            <UiCardDescription>Manage your active sessions across devices</UiCardDescription>
          </div>
          <UiButton variant="outline" size="sm" @click="handleRevokeAllSessions">
            Revoke All Others
          </UiButton>
        </div>
      </UiCardHeader>
      <UiCardContent>
        <div v-if="isLoadingSessions" class="flex items-center justify-center py-8">
          <Icon name="svg-spinners:ring-resize" class="size-6 text-muted-foreground" />
        </div>

        <div v-else-if="sessions.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="lucide:monitor" class="size-12 mx-auto mb-2 opacity-50" />
          <p>No active sessions found</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="sess in sessions"
            :key="sess.token"
            class="flex items-center justify-between p-3 border rounded-lg"
            :class="isCurrentSession(sess.token) ? 'bg-primary/5 border-primary/20' : ''"
          >
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Icon
                  :name="parseUserAgent(sess.userAgent).os === 'macOS' ? 'lucide:laptop' : 'lucide:monitor'"
                  class="size-5 text-muted-foreground"
                />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium">
                    {{ parseUserAgent(sess.userAgent).browser }} on {{ parseUserAgent(sess.userAgent).os }}
                  </p>
                  <UiBadge v-if="isCurrentSession(sess.token)" variant="default" class="text-xs">
                    Current
                  </UiBadge>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ sess.ipAddress || "Unknown IP" }} • Last active {{ formatDate(sess.updatedAt || sess.createdAt) }}
                </p>
              </div>
            </div>

            <UiButton
              v-if="!isCurrentSession(sess.token)"
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive"
              :disabled="isRevokingSession === sess.token"
              @click="handleRevokeSession(sess.token)"
            >
              <Icon
                v-if="isRevokingSession === sess.token"
                name="svg-spinners:ring-resize"
                class="size-4"
              />
              <Icon v-else name="lucide:x" class="size-4" />
            </UiButton>
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
