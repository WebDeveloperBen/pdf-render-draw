<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Admin Dashboard" })

interface AdminStats {
  users: { total: number; recentSignups: number; banned: number }
  organizations: { total: number }
  projects: { total: number }
  sessions: { active: number }
}

const stats = ref<AdminStats | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const fetchStats = async () => {
  isLoading.value = true
  error.value = null
  try {
    stats.value = await $fetch<AdminStats>("/api/admin/stats")
  } catch (e: any) {
    error.value = e.data?.message || "Failed to load stats"
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
})

// Stat cards configuration
const statCards = computed(() => {
  if (!stats.value) return []
  return [
    {
      title: "Total Users",
      value: stats.value.users.total,
      icon: "lucide:users",
      description: `${stats.value.users.recentSignups} new this week`,
      color: "text-blue-500"
    },
    {
      title: "Organizations",
      value: stats.value.organizations.total,
      icon: "lucide:building-2",
      description: "Active organizations",
      color: "text-green-500"
    },
    {
      title: "Projects",
      value: stats.value.projects.total,
      icon: "lucide:folder-open",
      description: "Total projects created",
      color: "text-purple-500"
    },
    {
      title: "Active Sessions",
      value: stats.value.sessions.active,
      icon: "lucide:activity",
      description: "Currently logged in",
      color: "text-orange-500"
    },
    {
      title: "Banned Users",
      value: stats.value.users.banned,
      icon: "lucide:ban",
      description: "Accounts suspended",
      color: "text-red-500"
    }
  ]
})

// Quick actions for admins
const quickActions = [
  { title: "View All Users", url: "/admin/users", icon: "lucide:users" },
  { title: "View Organizations", url: "/admin/organizations", icon: "lucide:building-2" },
  { title: "View Audit Log", url: "/admin/audit-log", icon: "lucide:scroll-text" }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold">Admin Dashboard</h1>
      <p class="text-muted-foreground mt-1">Platform overview and quick actions</p>
    </div>

    <!-- Error state -->
    <UiAlert v-if="error" variant="destructive">
      <Icon name="lucide:alert-circle" class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- Stats Cards -->
    <div v-if="isLoading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiCard v-for="i in 5" :key="i">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <div class="h-4 w-24 bg-muted rounded animate-pulse" />
          <div class="h-4 w-4 bg-muted rounded animate-pulse" />
        </UiCardHeader>
        <UiCardContent>
          <div class="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
          <div class="h-3 w-32 bg-muted rounded animate-pulse" />
        </UiCardContent>
      </UiCard>
    </div>

    <div v-else-if="stats" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiCard v-for="card in statCards" :key="card.title">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiCardTitle class="text-sm font-medium">{{ card.title }}</UiCardTitle>
          <Icon :name="card.icon" :class="['size-4', card.color]" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ card.value.toLocaleString() }}</div>
          <p class="text-xs text-muted-foreground mt-1">{{ card.description }}</p>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Quick Actions -->
    <div class="grid gap-4 md:grid-cols-3">
      <UiCard
        v-for="action in quickActions"
        :key="action.url"
        class="cursor-pointer hover:shadow-md transition-shadow"
        @click="navigateTo(action.url)"
      >
        <UiCardHeader class="flex flex-row items-center gap-4">
          <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon :name="action.icon" class="size-5 text-primary" />
          </div>
          <div class="flex-1">
            <UiCardTitle class="text-base">{{ action.title }}</UiCardTitle>
          </div>
          <Icon name="lucide:arrow-right" class="size-4 text-muted-foreground" />
        </UiCardHeader>
      </UiCard>
    </div>

    <!-- Platform Info -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Platform Information</UiCardTitle>
        <UiCardDescription>Platform administration panel</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="flex items-start gap-3">
          <Icon name="lucide:shield" class="size-5 text-primary mt-0.5" />
          <div>
            <h4 class="font-medium">Admin Access Levels</h4>
            <p class="text-sm text-muted-foreground">
              Platform admins have tiered access: Viewer, Support, Admin, and Owner. Each tier has different
              capabilities.
            </p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <Icon name="lucide:scroll-text" class="size-5 text-primary mt-0.5" />
          <div>
            <h4 class="font-medium">Audit Logging</h4>
            <p class="text-sm text-muted-foreground">
              All administrative actions are logged for security and compliance purposes.
            </p>
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
