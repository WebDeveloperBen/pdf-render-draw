<script setup lang="ts">
const { activeOrg, isOrgAdmin, isOrgOwner, workspaceName, hasActiveOrganization, isLoading } = useActiveOrganization()

// Redirect to dashboard if no active org (only after loading completes)
watch(
  [hasActiveOrganization, isLoading],
  ([hasOrg, loading]) => {
    if (!loading && !hasOrg) {
      navigateTo("/")
    }
  },
  { immediate: true }
)

// Get org details
const orgData = computed(() => activeOrg.value?.data)
const membersCount = computed(() => orgData.value?.members?.length || 0)

useSeoMeta({
  title: computed(() => `${workspaceName.value} - Workplace`)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ workspaceName }}</h1>
        <p class="text-muted-foreground">Workplace overview and management</p>
      </div>
      <div v-if="isOrgAdmin" class="flex gap-2">
        <UiButton variant="outline" to="/organisation/settings">
          <Icon name="lucide:settings" class="size-4" />
          Settings
        </UiButton>
        <UiButton to="/organisation/members">
          <Icon name="lucide:user-plus" class="size-4" />
          Invite Members
        </UiButton>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <UiCardTitle class="text-sm font-medium">Members</UiCardTitle>
          <Icon name="lucide:users" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">{{ membersCount }}</div>
          <p class="text-xs text-muted-foreground">Active team members</p>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <UiCardTitle class="text-sm font-medium">Projects</UiCardTitle>
          <Icon name="lucide:folder-open" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">-</div>
          <p class="text-xs text-muted-foreground">Shared projects</p>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <UiCardTitle class="text-sm font-medium">Plan</UiCardTitle>
          <Icon name="lucide:credit-card" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">Free</div>
          <p class="text-xs text-muted-foreground">Current subscription</p>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <UiCardTitle class="text-sm font-medium">Storage</UiCardTitle>
          <Icon name="lucide:hard-drive" class="size-4 text-muted-foreground" />
        </UiCardHeader>
        <UiCardContent>
          <div class="text-2xl font-bold">0 MB</div>
          <p class="text-xs text-muted-foreground">of 100 MB used</p>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Quick Actions -->
    <div class="grid gap-4 md:grid-cols-2">
      <UiCard class="flex flex-col">
        <UiCardHeader>
          <UiCardTitle>Team Members</UiCardTitle>
          <UiCardDescription> Manage your workplace's team members and their roles. </UiCardDescription>
        </UiCardHeader>
        <UiCardContent class="flex-1">
          <div v-if="orgData?.members?.length" class="space-y-3">
            <div v-for="member in orgData.members.slice(0, 2)" :key="member.id" class="flex items-center gap-3">
              <UiAvatar class="size-8">
                <UiAvatarImage v-if="member.user?.image" :src="member.user.image" />
                <UiAvatarFallback>
                  {{ member.user?.name?.[0]?.toUpperCase() || "?" }}
                </UiAvatarFallback>
              </UiAvatar>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ member.user?.name || "Unknown" }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ member.user?.email }}</p>
              </div>
              <UiBadge :variant="member.role === 'owner' ? 'default' : 'secondary'" class="capitalize">
                {{ member.role }}
              </UiBadge>
            </div>
          </div>
          <p v-else class="text-sm text-muted-foreground">No members found</p>
        </UiCardContent>
        <UiCardFooter v-if="isOrgAdmin">
          <UiButton variant="outline" class="w-full" to="/organisation/members">
            View All Members
            <Icon name="lucide:arrow-right" class="size-4" />
          </UiButton>
        </UiCardFooter>
      </UiCard>

      <UiCard class="flex flex-col">
        <UiCardHeader>
          <UiCardTitle>Workplace Details</UiCardTitle>
          <UiCardDescription> Basic information about your workplace. </UiCardDescription>
        </UiCardHeader>
        <UiCardContent class="flex-1 space-y-4">
          <div class="flex items-center gap-4">
            <div class="flex size-16 items-center justify-center rounded-lg bg-primary/10">
              <img v-if="orgData?.logo" :src="orgData.logo" :alt="orgData.name" class="size-10 rounded object-cover" />
              <Icon v-else name="lucide:building-2" class="size-8 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold">{{ orgData?.name }}</h3>
              <p class="text-sm text-muted-foreground">{{ orgData?.slug }}</p>
            </div>
          </div>

          <UiDivider />

          <div class="grid gap-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Created</span>
              <span>{{ orgData?.createdAt ? new Date(orgData.createdAt).toLocaleDateString() : "-" }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Your Role</span>
              <UiBadge variant="outline" class="capitalize">
                {{ isOrgOwner ? "Owner" : isOrgAdmin ? "Admin" : "Member" }}
              </UiBadge>
            </div>
          </div>
        </UiCardContent>
        <UiCardFooter v-if="isOrgAdmin">
          <UiButton variant="outline" class="w-full" to="/organisation/settings">
            Edit Workplace
            <Icon name="lucide:pencil" class="size-4" />
          </UiButton>
        </UiCardFooter>
      </UiCard>
    </div>
  </div>
</template>
