<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

const route = useRoute("admin-organizations-id")
const orgId = computed(() => route.params.id)

interface OrgMember {
  id: string
  role: string
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    banned: boolean | null
  } | null
}

interface OrgDetail {
  id: string
  name: string
  slug: string
  logo: string | null
  metadata: string | null
  createdAt: Date
  members: OrgMember[]
  _count: {
    members: number
    projects: number
    pendingInvitations: number
  }
}

// State
const org = ref<OrgDetail | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// Fetch organization
const fetchOrg = async () => {
  isLoading.value = true
  error.value = null
  try {
    org.value = await $fetch<OrgDetail>(`/api/admin/organizations/${orgId.value}`)
  } catch (e: any) {
    error.value = e.data?.message || "Failed to load organization"
  } finally {
    isLoading.value = false
  }
}

useSeoMeta({
  title: computed(() => (org.value ? `${org.value.name} - Admin` : "Organization - Admin"))
})

// Format date
const formatDate = (date: Date | string | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  })
}

// Role badge variant
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "owner":
      return "default"
    case "admin":
      return "secondary"
    default:
      return "outline"
  }
}

onMounted(() => {
  fetchOrg()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <UiButton variant="ghost" size="sm" @click="navigateTo('/admin/organizations')">
      <Icon name="lucide:arrow-left" class="size-4 mr-2" />
      Back to Organizations
    </UiButton>

    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-6">
      <div class="flex items-center gap-4">
        <div class="size-20 rounded-lg bg-muted animate-pulse" />
        <div class="space-y-2">
          <div class="h-8 w-48 bg-muted rounded animate-pulse" />
          <div class="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Error state -->
    <UiAlert v-else-if="error" variant="destructive">
      <Icon name="lucide:alert-circle" class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- Organization details -->
    <template v-else-if="org">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-4">
          <UiAvatar class="size-20 rounded-lg">
            <UiAvatarImage v-if="org.logo" :src="org.logo" :alt="org.name" />
            <UiAvatarFallback class="rounded-lg text-2xl">{{ org.name[0]?.toUpperCase() }}</UiAvatarFallback>
          </UiAvatar>
          <div>
            <h1 class="text-3xl font-bold">{{ org.name }}</h1>
            <p class="text-muted-foreground">@{{ org.slug }}</p>
            <p class="text-xs text-muted-foreground mt-1">ID: {{ org.id }}</p>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid gap-4 md:grid-cols-3">
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Members</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold">{{ org._count.members }}</div>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Projects</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold">{{ org._count.projects }}</div>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Pending Invitations</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold">{{ org._count.pendingInvitations }}</div>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- Organization info and members -->
      <div class="grid gap-6 md:grid-cols-2">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Organization Details</UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="space-y-4">
            <div>
              <p class="text-sm text-muted-foreground">Name</p>
              <p class="font-medium">{{ org.name }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Slug</p>
              <p class="font-medium">@{{ org.slug }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Created</p>
              <p class="font-medium">{{ formatDate(org.createdAt) }}</p>
            </div>
            <div v-if="org.metadata">
              <p class="text-sm text-muted-foreground">Metadata</p>
              <pre class="text-xs bg-muted p-2 rounded mt-1 overflow-auto">{{ org.metadata }}</pre>
            </div>
          </UiCardContent>
        </UiCard>

        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Members ({{ org.members.length }})</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="org.members.length === 0" class="text-center py-8 text-muted-foreground">
              <Icon name="lucide:users" class="size-12 mx-auto mb-4 opacity-50" />
              <p>No members</p>
            </div>
            <div v-else class="space-y-3 max-h-96 overflow-y-auto">
              <div
                v-for="membership in org.members"
                :key="membership.id"
                class="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                @click="membership.user && navigateTo(`/admin/users/${membership.user.id}`)"
              >
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-10">
                    <UiAvatarImage
                      v-if="membership.user?.image"
                      :src="membership.user.image"
                      :alt="membership.user?.name || 'User'"
                    />
                    <UiAvatarFallback>{{
                      (membership.user?.name || membership.user?.email)?.[0]?.toUpperCase()
                    }}</UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="font-medium">{{ membership.user?.name || "Unknown" }}</p>
                      <UiBadge v-if="membership.user?.banned" variant="destructive" class="text-xs">Banned</UiBadge>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ membership.user?.email }}</p>
                  </div>
                </div>
                <UiBadge :variant="getRoleBadgeVariant(membership.role)">{{ membership.role }}</UiBadge>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </template>
  </div>
</template>
