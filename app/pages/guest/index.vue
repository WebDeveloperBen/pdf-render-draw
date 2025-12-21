<script setup lang="ts">
definePageMeta({
  layout: "guest",
  middleware: ["guest"]
})

// Handle incoming share parameter from magic link
const route = useRoute()
const shareId = route.query.share as string | undefined

// Fetch shares accessible to this user
const {
  data: shares,
  status,
  error
} = await useFetch("/api/guest/shares", {
  key: "guest-shares"
})

// If we came from a magic link with a share ID, redirect to that share
onMounted(() => {
  if (shareId && shares.value) {
    const matchingShare = shares.value.find((s) => s.shareId === shareId)
    if (matchingShare) {
      navigateTo(`/guest/projects/${matchingShare.share.token}`)
    }
  }
})

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

useSeoMeta({
  title: "Shared Projects"
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Shared Projects</h1>
      <p class="text-muted-foreground">Projects that have been shared with you</p>
    </div>

    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
      <Icon name="svg-spinners:ring-resize" class="size-8 text-primary" />
    </div>

    <!-- Error state -->
    <UiCard v-else-if="error" class="border-destructive">
      <UiCardContent class="flex flex-col items-center gap-4 py-12">
        <Icon name="lucide:alert-circle" class="size-12 text-destructive" />
        <div class="text-center">
          <h3 class="font-semibold">Failed to load shares</h3>
          <p class="text-sm text-muted-foreground">{{ error.message }}</p>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Empty state -->
    <UiCard v-else-if="!shares || shares.length === 0">
      <UiCardContent class="flex flex-col items-center gap-4 py-12">
        <div class="flex size-16 items-center justify-center rounded-full bg-muted">
          <Icon name="lucide:folder-open" class="size-8 text-muted-foreground" />
        </div>
        <div class="text-center">
          <h3 class="font-semibold">No shared projects</h3>
          <p class="text-sm text-muted-foreground">
            When someone shares a project with you, it will appear here.
          </p>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Projects grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="item in shares"
        :key="item.id"
        :to="`/guest/projects/${item.share.token}`"
        class="group"
      >
        <UiCard class="overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
          <!-- Thumbnail -->
          <div class="aspect-[4/3] bg-muted relative overflow-hidden">
            <img
              v-if="item.project.thumbnailUrl"
              :src="item.project.thumbnailUrl"
              :alt="item.project.name"
              class="size-full object-cover transition-transform group-hover:scale-105"
            />
            <div v-else class="flex size-full items-center justify-center">
              <Icon name="lucide:file-text" class="size-12 text-muted-foreground" />
            </div>

            <!-- Overlay with org info -->
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <div class="flex items-center gap-2">
                <div
                  v-if="item.organization?.logo"
                  class="size-6 overflow-hidden rounded bg-white/90"
                >
                  <img :src="item.organization.logo" class="size-full object-contain" />
                </div>
                <div v-else class="flex size-6 items-center justify-center rounded bg-white/90">
                  <Icon name="lucide:building-2" class="size-3 text-muted-foreground" />
                </div>
                <span class="text-xs font-medium text-white">
                  {{ item.organization?.name || "Unknown Organization" }}
                </span>
              </div>
            </div>
          </div>

          <UiCardContent class="p-4">
            <div class="space-y-2">
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                  {{ item.project.name }}
                </h3>
                <UiBadge v-if="item.status === 'pending'" variant="secondary" class="shrink-0 text-xs">
                  New
                </UiBadge>
              </div>

              <p v-if="item.project.description" class="text-sm text-muted-foreground line-clamp-2">
                {{ item.project.description }}
              </p>

              <div class="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                <div class="flex items-center gap-1">
                  <Icon name="lucide:file" class="size-3" />
                  <span>{{ item.project.pageCount }} pages</span>
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="lucide:calendar" class="size-3" />
                  <span>{{ formatDate(item.invitedAt) }}</span>
                </div>
              </div>

              <!-- Shared by -->
              <div class="flex items-center gap-2 pt-2 border-t">
                <UiAvatar class="size-5">
                  <UiAvatarImage v-if="item.sharedBy?.image" :src="item.sharedBy.image" />
                  <UiAvatarFallback class="text-[10px]">
                    {{ item.sharedBy?.name?.[0]?.toUpperCase() || "?" }}
                  </UiAvatarFallback>
                </UiAvatar>
                <span class="text-xs text-muted-foreground">
                  Shared by {{ item.sharedBy?.name || "Unknown" }}
                </span>
              </div>

              <!-- Message preview -->
              <div
                v-if="item.share.message"
                class="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground italic line-clamp-2"
              >
                "{{ item.share.message }}"
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </NuxtLink>
    </div>
  </div>
</template>
