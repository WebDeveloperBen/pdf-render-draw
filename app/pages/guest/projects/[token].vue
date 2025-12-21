<script setup lang="ts">
definePageMeta({
  layout: "guest",
  middleware: ["guest"]
})

const route = useRoute()
const token = computed(() => {
  const params = route.params as { token?: string }
  return params.token || ""
})

// Fetch the shared project data
const {
  data: shareData,
  status,
  error
} = await useFetch(() => `/api/share/${token.value}`, {
  key: `share-${token.value}`
})

// Handle password-protected shares
const password = ref("")
const passwordError = ref("")
const isSubmittingPassword = ref(false)

const requiresPassword = computed(() => {
  return error.value?.statusCode === 400 && error.value?.statusMessage === "Password required for this share"
})

const submitPassword = async () => {
  if (!password.value) {
    passwordError.value = "Please enter a password"
    return
  }

  isSubmittingPassword.value = true
  passwordError.value = ""

  try {
    await $fetch(`/api/share/${token.value}?password=${encodeURIComponent(password.value)}`)
    // Refresh the page with the password in the URL
    window.location.href = `/guest/projects/${token.value}?password=${encodeURIComponent(password.value)}`
  } catch (e: any) {
    passwordError.value = e.data?.statusMessage || "Invalid password"
  } finally {
    isSubmittingPassword.value = false
  }
}

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  })
}

useSeoMeta({
  title: computed(() => shareData.value?.name ? `${shareData.value.name} - Shared Project` : "Shared Project")
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="status === 'pending'" class="flex items-center justify-center py-24">
      <div class="flex flex-col items-center gap-4">
        <Icon name="svg-spinners:ring-resize" class="size-12 text-primary" />
        <p class="text-muted-foreground">Loading shared project...</p>
      </div>
    </div>

    <!-- Password required -->
    <div v-else-if="requiresPassword" class="flex items-center justify-center py-24">
      <UiCard class="w-full max-w-md">
        <UiCardHeader class="text-center">
          <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <Icon name="lucide:lock" class="size-8 text-muted-foreground" />
          </div>
          <UiCardTitle>Password Protected</UiCardTitle>
          <UiCardDescription>
            This project is password protected. Enter the password to continue.
          </UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <form class="space-y-4" @submit.prevent="submitPassword">
            <div class="space-y-2">
              <UiLabel for="password">Password</UiLabel>
              <UiInput
                id="password"
                v-model="password"
                type="password"
                placeholder="Enter password"
                :disabled="isSubmittingPassword"
              />
              <p v-if="passwordError" class="text-sm text-destructive">{{ passwordError }}</p>
            </div>
            <UiButton type="submit" class="w-full" :disabled="isSubmittingPassword">
              <Icon v-if="isSubmittingPassword" name="svg-spinners:ring-resize" class="size-4" />
              <Icon v-else name="lucide:unlock" class="size-4" />
              Unlock Project
            </UiButton>
          </form>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex items-center justify-center py-24">
      <UiCard class="w-full max-w-md border-destructive">
        <UiCardContent class="flex flex-col items-center gap-4 py-8">
          <div class="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <Icon name="lucide:alert-circle" class="size-8 text-destructive" />
          </div>
          <div class="text-center">
            <h3 class="font-semibold">Unable to load project</h3>
            <p class="text-sm text-muted-foreground mt-1">{{ error.statusMessage || error.message }}</p>
          </div>
          <NuxtLink to="/guest">
            <UiButton variant="outline">
              <Icon name="lucide:arrow-left" class="size-4" />
              Back to Shared Projects
            </UiButton>
          </NuxtLink>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Project content -->
    <template v-else-if="shareData">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <NuxtLink to="/guest" class="text-muted-foreground hover:text-foreground transition-colors">
              <Icon name="lucide:arrow-left" class="size-4" />
            </NuxtLink>
            <h1 class="text-2xl font-bold tracking-tight">{{ shareData.name }}</h1>
          </div>
          <p v-if="shareData.description" class="text-muted-foreground">{{ shareData.description }}</p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Download button -->
          <a
            v-if="shareData.share.allowDownload"
            :href="shareData.pdfUrl"
            target="_blank"
            download
          >
            <UiButton variant="outline">
              <Icon name="lucide:download" class="size-4" />
              Download PDF
            </UiButton>
          </a>

          <!-- Open in viewer button -->
          <NuxtLink :to="`/editor/${token}?shared=true`">
            <UiButton>
              <Icon name="lucide:maximize-2" class="size-4" />
              Open Viewer
            </UiButton>
          </NuxtLink>
        </div>
      </div>

      <!-- Project info cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UiCard>
          <UiCardContent class="flex items-center gap-3 p-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon name="lucide:file-text" class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Pages</p>
              <p class="text-xl font-semibold">{{ shareData.pageCount }}</p>
            </div>
          </UiCardContent>
        </UiCard>

        <UiCard>
          <UiCardContent class="flex items-center gap-3 p-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Icon name="lucide:eye" class="size-5 text-blue-500" />
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Views</p>
              <p class="text-xl font-semibold">{{ shareData.share.viewCount }}</p>
            </div>
          </UiCardContent>
        </UiCard>

        <UiCard>
          <UiCardContent class="flex items-center gap-3 p-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
              <Icon name="lucide:message-square" class="size-5 text-green-500" />
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Notes</p>
              <p class="text-xl font-semibold">
                {{ shareData.share.canAddNotes ? "Enabled" : "View Only" }}
              </p>
            </div>
          </UiCardContent>
        </UiCard>

        <UiCard>
          <UiCardContent class="flex items-center gap-3 p-4">
            <div class="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Icon name="lucide:download" class="size-5 text-orange-500" />
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Download</p>
              <p class="text-xl font-semibold">
                {{ shareData.share.allowDownload ? "Allowed" : "Disabled" }}
              </p>
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- PDF Preview -->
      <UiCard>
        <UiCardHeader>
          <UiCardTitle>Document Preview</UiCardTitle>
          <UiCardDescription>
            {{ shareData.pdfFileName }}
          </UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <div class="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            <img
              v-if="shareData.thumbnailUrl"
              :src="shareData.thumbnailUrl"
              :alt="shareData.name"
              class="size-full object-contain"
            />
            <div v-else class="flex size-full items-center justify-center">
              <div class="text-center">
                <Icon name="lucide:file-text" class="mx-auto size-16 text-muted-foreground" />
                <p class="mt-2 text-sm text-muted-foreground">Preview not available</p>
              </div>
            </div>
          </div>
        </UiCardContent>
        <UiCardFooter>
          <NuxtLink :to="`/editor/${token}?shared=true`" class="w-full">
            <UiButton class="w-full">
              <Icon name="lucide:maximize-2" class="size-4" />
              Open Full Viewer
            </UiButton>
          </NuxtLink>
        </UiCardFooter>
      </UiCard>

      <!-- Shared by info -->
      <UiCard>
        <UiCardContent class="p-4">
          <div class="flex items-center gap-4">
            <UiAvatar class="size-12">
              <UiAvatarImage v-if="shareData.creator?.image" :src="shareData.creator.image" />
              <UiAvatarFallback>
                {{ shareData.creator?.name?.[0]?.toUpperCase() || "?" }}
              </UiAvatarFallback>
            </UiAvatar>
            <div class="flex-1">
              <p class="font-medium">{{ shareData.creator?.name || "Unknown" }}</p>
              <p class="text-sm text-muted-foreground">{{ shareData.creator?.email }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-muted-foreground">Shared from</p>
              <p class="font-medium">{{ shareData.organization?.name || "Unknown Organization" }}</p>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </template>
  </div>
</template>
