<script setup lang="ts">
useSeoMeta({ title: "Dashboard" })

const session = authClient.useSession()

const handleSignOut = async () => {
  await authClient.signOut()
  navigateTo("/login")
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <UiButton v-if="session.data" variant="outline" @click="handleSignOut"> Sign Out </UiButton>
    </div>

    <div v-if="session.data" class="space-y-4">
      <p class="text-muted-foreground">Welcome to MetreMate. Your recent projects and activity will appear here.</p>

      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Session Info</UiCardTitle>
        </UiCardHeader>
        <UiCardContent>
          <pre class="text-sm">{{ session.data }}</pre>
        </UiCardContent>
      </UiCard>
    </div>

    <div v-else class="space-y-4">
      <p class="text-muted-foreground">Please sign in to continue.</p>
      <UiButton @click="navigateTo('/login')"> Go to Login </UiButton>
    </div>
  </div>
</template>
