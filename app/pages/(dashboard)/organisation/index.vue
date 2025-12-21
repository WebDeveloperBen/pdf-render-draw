<script setup lang="ts">
const { activeOrg, isOrgAdmin, isOrgOwner, workspaceName, hasActiveOrganization } = useActiveOrganization()

// Redirect to dashboard if no active org
watch(
  hasActiveOrganization,
  (hasOrg) => {
    if (!hasOrg) {
      navigateTo("/")
    }
  },
  { immediate: true }
)

// Get org details
const orgData = computed(() => activeOrg.value?.data)
const membersCount = computed(() => orgData.value?.members?.length || 0)

useSeoMeta({
  title: computed(() => `${workspaceName.value} - Organization`)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ workspaceName }}</h1>
        <p class="text-muted-foreground">Organization overview and management</p>
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
      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Team Members</UiCardTitle>
          <UiCardDescription> Manage your organization's team members and their roles. </UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <div v-if="orgData?.members?.length" class="space-y-3">
            <div v-for="member in orgData.members.slice(0, 5)" :key="member.id" class="flex items-center gap-3">
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

      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Organization Details</UiCardTitle>
          <UiCardDescription> Basic information about your organization. </UiCardDescription>
        </UiCardHeader>
        <UiCardContent class="space-y-4">
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
            Edit Organization
            <Icon name="lucide:pencil" class="size-4" />
          </UiButton>
        </UiCardFooter>
      </UiCard>
    </div>
  </div>
</template>
