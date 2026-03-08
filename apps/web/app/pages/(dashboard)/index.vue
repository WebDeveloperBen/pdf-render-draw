<script setup lang="ts">
useSeoMeta({ title: "Dashboard" })

const session = authClient.useSession()
const { activeOrg } = useActiveOrganization()

// Get organization ID for async components
const organizationId = computed(() => activeOrg.value?.data?.id)

// Session is loading if isPending is true or data is undefined
const isSessionLoading = computed(() => {
  return session.value?.isPending || session.value?.data === undefined
})

const handleSignOut = async () => {
  await authClient.signOut()
  navigateTo("/login")
}
</script>

<template>
  <!-- Loading state while session initializes -->
  <SkeletonDashboard v-if="isSessionLoading" />

  <!-- Not authenticated -->
  <div v-else-if="!session?.data?.user" class="space-y-4">
    <p class="text-muted-foreground">Please sign in to continue.</p>
    <UiButton @click="navigateTo('/login')"> Go to Login </UiButton>
  </div>

  <!-- Authenticated -->
  <div v-else class="space-y-6">
    <!-- Welcome Header (static) -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Welcome back, {{ session.data?.user?.name }}!</h1>
        <p class="text-muted-foreground mt-1">Here's what's happening with your projects</p>
      </div>
      <UiButton variant="outline" @click="handleSignOut"> Sign Out </UiButton>
    </div>

    <!-- Pending Invitations (static) -->
    <PendingInvitations />

    <!-- Quick Actions (async) -->
    <Suspense v-if="organizationId">
      <DashboardQuickActions :organization-id="organizationId" />
      <template #fallback>
        <div class="grid gap-4 md:grid-cols-3">
          <UiCard v-for="i in 3" :key="i">
            <UiCardHeader class="flex flex-row items-center justify-between pb-2">
              <div class="h-4 w-24 bg-muted rounded animate-pulse" />
              <div class="size-4 bg-muted rounded animate-pulse" />
            </UiCardHeader>
            <UiCardContent>
              <div class="h-8 w-12 bg-muted rounded animate-pulse mb-1" />
              <div class="h-3 w-32 bg-muted rounded animate-pulse mt-2" />
            </UiCardContent>
          </UiCard>
        </div>
      </template>
    </Suspense>

    <!-- Recent Projects (async) -->
    <Suspense v-if="organizationId">
      <DashboardRecentProjects :organization-id="organizationId" />
      <template #fallback>
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-2xl font-semibold">Recent Projects</h2>
              <p class="text-sm text-muted-foreground">Your recently updated projects</p>
            </div>
            <div class="h-9 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <UiCard v-for="i in 3" :key="i" class="overflow-hidden">
              <UiCardHeader class="p-0">
                <div class="aspect-video bg-muted animate-pulse" />
              </UiCardHeader>
              <UiCardContent class="p-4 space-y-2">
                <div class="h-4 bg-muted rounded animate-pulse" />
                <div class="h-3 bg-muted rounded w-2/3 animate-pulse" />
              </UiCardContent>
            </UiCard>
          </div>
        </div>
      </template>
    </Suspense>

    <!-- Getting Started Guide (static) -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Getting Started</UiCardTitle>
        <UiCardDescription>Quick guide to help you get the most out of the app</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="flex items-start gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          >
            1
          </div>
          <div class="flex-1">
            <h4 class="font-medium mb-1">Upload Your Building Plans</h4>
            <p class="text-sm text-muted-foreground">
              Create a new project and upload your PDF building plans to get started.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          >
            2
          </div>
          <div class="flex-1">
            <h4 class="font-medium mb-1">Measure and Annotate</h4>
            <p class="text-sm text-muted-foreground">
              Use the powerful editor tools to measure distances, areas, and add annotations directly on your plans.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
          >
            3
          </div>
          <div class="flex-1">
            <h4 class="font-medium mb-1">Share with Your Team</h4>
            <p class="text-sm text-muted-foreground">
              Generate shareable links to collaborate with clients and team members.
            </p>
          </div>
        </div>
      </UiCardContent>
      <UiCardFooter>
        <UiButton variant="outline" @click="navigateTo('/support')"> Learn More </UiButton>
      </UiCardFooter>
    </UiCard>
  </div>
</template>
