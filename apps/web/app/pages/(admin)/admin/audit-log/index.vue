<script setup lang="ts">
import { toast } from "vue-sonner"
import type { AuditLogEntry } from "@shared/auth/plugins/platform-admin.client"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Audit Log - Admin" })

// State
const logs = ref<AuditLogEntry[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const limit = ref(50)
const offset = ref(0)
const hasMore = ref(true)

// Fetch audit logs
const fetchLogs = async (append = false) => {
  if (!append) {
    isLoading.value = true
    offset.value = 0
  }
  error.value = null

  try {
    const response = await authClient.platformAdmin.getAuditLog({
      limit: limit.value,
      offset: offset.value
    })
    const newLogs = response.data?.logs ?? []

    if (append) {
      logs.value = [...logs.value, ...newLogs]
    } else {
      logs.value = newLogs
    }

    hasMore.value = newLogs.length === limit.value
  } catch (e: any) {
    error.value = e.message || "Failed to load audit logs"
  } finally {
    isLoading.value = false
  }
}

// Load more logs
const loadMore = async () => {
  offset.value += limit.value
  await fetchLogs(true)
}

// Format date
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

// Get action type icon and color
const getActionDisplay = (actionType: string) => {
  const actions: Record<string, { icon: string; color: string; label: string }> = {
    grant_platform_admin: { icon: "lucide:user-plus", color: "text-green-500", label: "Granted Admin Access" },
    revoke_platform_admin: { icon: "lucide:user-minus", color: "text-red-500", label: "Revoked Admin Access" },
    update_platform_admin_tier: { icon: "lucide:edit", color: "text-blue-500", label: "Updated Admin Tier" },
    ban_user: { icon: "lucide:ban", color: "text-red-500", label: "Banned User" },
    unban_user: { icon: "lucide:user-check", color: "text-green-500", label: "Unbanned User" },
    impersonate_user: { icon: "lucide:eye", color: "text-orange-500", label: "Impersonated User" },
    delete_user: { icon: "lucide:trash-2", color: "text-red-500", label: "Deleted User" },
    delete_organization: { icon: "lucide:trash-2", color: "text-red-500", label: "Deleted Organization" }
  }

  return (
    actions[actionType] || {
      icon: "lucide:activity",
      color: "text-muted-foreground",
      label: actionType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    }
  )
}

// Format metadata for display
const formatMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return null
  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return null
  }
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Audit Log</h1>
        <p class="text-muted-foreground mt-1">Track all administrative actions</p>
      </div>
      <UiButton variant="outline" :disabled="isLoading" @click="fetchLogs()">
        <Icon name="lucide:refresh-cw" class="size-4 mr-2" />
        Refresh
      </UiButton>
    </div>

    <!-- Error state -->
    <UiAlert v-if="error" variant="destructive">
      <Icon name="lucide:alert-circle" class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- Audit Log Table -->
    <UiCard>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-4 font-medium">Action</th>
              <th class="text-left p-4 font-medium">Admin</th>
              <th class="text-left p-4 font-medium">Target</th>
              <th class="text-left p-4 font-medium">Timestamp</th>
              <th class="text-left p-4 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading state -->
            <template v-if="isLoading && logs.length === 0">
              <tr v-for="i in 5" :key="i" class="border-b">
                <td class="p-4">
                  <div class="flex items-center gap-2">
                    <div class="size-4 bg-muted rounded animate-pulse" />
                    <div class="h-4 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </td>
                <td class="p-4"><div class="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-32 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-16 bg-muted rounded animate-pulse" /></td>
              </tr>
            </template>

            <!-- Empty state -->
            <tr v-else-if="logs.length === 0">
              <td colspan="5" class="p-8 text-center text-muted-foreground">
                <Icon name="lucide:scroll-text" class="size-12 mx-auto mb-4 opacity-50" />
                <p>No audit log entries found</p>
              </td>
            </tr>

            <!-- Log rows -->
            <tr v-for="log in logs" v-else :key="log.id" class="border-b hover:bg-muted/50 transition-colors">
              <td class="p-4">
                <div class="flex items-center gap-2">
                  <Icon
                    :name="getActionDisplay(log.actionType).icon"
                    :class="['size-4', getActionDisplay(log.actionType).color]"
                  />
                  <span class="font-medium">{{ getActionDisplay(log.actionType).label }}</span>
                </div>
              </td>
              <td class="p-4">
                <div v-if="log.admin" class="flex items-center gap-2">
                  <span>{{ log.admin.name || log.admin.email }}</span>
                </div>
                <span v-else class="text-muted-foreground">System</span>
              </td>
              <td class="p-4">
                <div v-if="log.targetUser">
                  <NuxtLink :to="`/admin/users/${log.targetUser.id}`" class="text-primary hover:underline">
                    {{ log.targetUser.name || log.targetUser.email }}
                  </NuxtLink>
                </div>
                <span v-else class="text-muted-foreground">-</span>
              </td>
              <td class="p-4 text-muted-foreground">
                {{ formatDate(log.createdAt) }}
              </td>
              <td class="p-4">
                <UiPopover v-if="log.metadata || log.ipAddress">
                  <UiPopoverTrigger>
                    <UiButton variant="ghost" size="sm">
                      <Icon name="lucide:info" class="size-4" />
                    </UiButton>
                  </UiPopoverTrigger>
                  <UiPopoverContent class="w-80">
                    <div class="space-y-2">
                      <h4 class="font-medium">Details</h4>
                      <div v-if="log.ipAddress" class="text-sm">
                        <span class="text-muted-foreground">IP Address:</span>
                        {{ log.ipAddress }}
                      </div>
                      <div v-if="log.metadata" class="text-sm">
                        <span class="text-muted-foreground">Metadata:</span>
                        <pre class="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-40">{{
                          formatMetadata(log.metadata)
                        }}</pre>
                      </div>
                    </div>
                  </UiPopoverContent>
                </UiPopover>
                <span v-else class="text-muted-foreground">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Load More -->
      <div v-if="hasMore && logs.length > 0" class="p-4 border-t text-center">
        <UiButton variant="outline" :disabled="isLoading" @click="loadMore">
          <Icon v-if="isLoading" name="lucide:loader-2" class="size-4 mr-2 animate-spin" />
          Load More
        </UiButton>
      </div>
    </UiCard>
  </div>
</template>
