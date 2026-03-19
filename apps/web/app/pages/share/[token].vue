<script setup lang="ts">
/**
 * Public share page - handles both public and private shares
 * - Public shares: view directly (with optional password)
 * - Private shares: redirect to magic link auth flow
 */
import { toast } from "vue-sonner"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"
import type { FormBuilder } from "@/components/ui/FormBuilder/FormBuilder.vue"
import { AlertCircle, Download, ExternalLink, Eye, File, FileText, Key, Lock, Unlock } from "lucide-vue-next"
import { isApiError, withResponseData } from "~/utils/customFetch"

definePageMeta({
  layout: false // No layout for public page
})

const route = useRoute("share-token")
const token = computed(() => route.params.token)

// Get password from URL if present (after successful password submission)
const urlPassword = computed(() => (route.query.password as string) || undefined)

// Fetch the share data using generated API hook
const {
  data: shareResponse,
  error,
  status
} = useGetApiShareToken(token, urlPassword.value ? { password: urlPassword.value } : undefined, withResponseData())

const shareData = computed(() => shareResponse.value ?? null)

// Error state helpers
const requiresPassword = computed(() => {
  return isApiError(error.value) && error.value.status === 400
})

const requiresAuth = computed(() => {
  return isApiError(error.value) && error.value.status === 403
})

// Password form schema
const passwordSchema = toTypedSchema(
  z.object({
    password: z.string().min(1, "Password is required")
  })
)

const form = useForm({
  validationSchema: passwordSchema,
  initialValues: {
    password: ""
  }
})

const isSubmittingPassword = ref(false)

// FormBuilder field for password
const passwordFields: FormBuilder[] = [
  {
    variant: "Input",
    name: "password",
    label: "Password",
    type: "password",
    placeholder: "Enter password",
    required: true,
    wrapperClass: "space-y-2"
  }
]

// Handle password submission
const handlePasswordSubmit = form.handleSubmit(async (values) => {
  isSubmittingPassword.value = true

  try {
    // Reload page with password in URL
    window.location.href = `/share/${token.value}?password=${encodeURIComponent(values.password)}`
  } catch (e: any) {
    toast.error(e.data?.statusMessage || "Invalid password")
    isSubmittingPassword.value = false
  }
})

useSeoMeta({
  title: computed(() => (shareData.value?.name ? `${shareData.value.name} - Shared` : "Shared Project"))
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Simple header -->
    <header class="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div class="container flex h-14 items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold">
          <FileText class="size-5 text-primary" />
          <span>PDF Annotator</span>
        </NuxtLink>
        <NuxtLink to="/login">
          <UiButton variant="outline" size="sm">Sign In</UiButton>
        </NuxtLink>
      </div>
    </header>

    <main class="container py-8">
      <!-- Loading -->
      <div v-if="status === 'pending'" class="flex items-center justify-center py-24">
        <div class="flex flex-col items-center gap-4">
          <UiSpinner class="size-12 text-primary" />
          <p class="text-muted-foreground">Loading shared project...</p>
        </div>
      </div>

      <!-- Requires authentication (private share) -->
      <div v-else-if="requiresAuth" class="flex items-center justify-center py-24">
        <UiCard class="w-full max-w-md">
          <UiCardHeader class="text-center">
            <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Lock class="size-8 text-primary" />
            </div>
            <UiCardTitle>Private Share</UiCardTitle>
            <UiCardDescription>
              This project was shared with specific people. Check your email for the access link.
            </UiCardDescription>
          </UiCardHeader>
          <UiCardFooter class="justify-center">
            <NuxtLink to="/login">
              <UiButton>Sign In</UiButton>
            </NuxtLink>
          </UiCardFooter>
        </UiCard>
      </div>

      <!-- Password required -->
      <div v-else-if="requiresPassword" class="flex items-center justify-center py-24">
        <UiCard class="w-full max-w-md">
          <UiCardHeader class="text-center">
            <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Key class="size-8 text-primary" />
            </div>
            <UiCardTitle>Password Protected</UiCardTitle>
            <UiCardDescription>Enter the password to view this shared project.</UiCardDescription>
          </UiCardHeader>
          <UiCardContent>
            <form class="space-y-4" @submit="handlePasswordSubmit">
              <UiFormBuilder :fields="passwordFields" />
              <UiButton type="submit" class="w-full" :disabled="isSubmittingPassword">
                <UiSpinner v-if="isSubmittingPassword" class="size-4" />
                <Unlock v-else class="size-4" />
                View Project
              </UiButton>
            </form>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- Other error -->
      <div v-else-if="error" class="flex items-center justify-center py-24">
        <UiCard class="w-full max-w-md border-destructive">
          <UiCardHeader class="text-center">
            <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle class="size-8 text-destructive" />
            </div>
            <UiCardTitle>Unable to Load</UiCardTitle>
            <UiCardDescription>This share link may be invalid or expired.</UiCardDescription>
          </UiCardHeader>
          <UiCardFooter class="justify-center">
            <NuxtLink to="/">
              <UiButton variant="outline">Go Home</UiButton>
            </NuxtLink>
          </UiCardFooter>
        </UiCard>
      </div>

      <!-- Success - show project viewer -->
      <div v-else-if="shareData" class="space-y-6">
        <!-- Project header -->
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <h1 class="text-2xl font-bold">{{ shareData.name }}</h1>
            <p v-if="shareData.description" class="text-muted-foreground">{{ shareData.description }}</p>
            <div class="flex items-center gap-4 text-sm text-muted-foreground">
              <span class="flex items-center gap-1">
                <File class="size-4" />
                {{ shareData.pageCount }} pages
              </span>
              <span class="flex items-center gap-1">
                <Eye class="size-4" />
                {{ shareData.share?.viewCount || 0 }} views
              </span>
            </div>
          </div>
          <div v-if="shareData.share?.allowDownload" class="flex items-center gap-2">
            <a :href="shareData.pdfUrl" target="_blank" download>
              <UiButton variant="outline">
                <Download class="size-4" />
                Download PDF
              </UiButton>
            </a>
          </div>
        </div>

        <!-- PDF viewer placeholder -->
        <UiCard>
          <UiCardContent class="p-0">
            <div class="aspect-4/3 bg-muted flex items-center justify-center">
              <div class="text-center space-y-4">
                <FileText class="size-16 text-muted-foreground mx-auto" />
                <div>
                  <p class="font-medium">PDF Viewer</p>
                  <p class="text-sm text-muted-foreground">Open in editor to view and annotate</p>
                </div>
                <NuxtLink :to="`/editor?share=${token}`">
                  <UiButton>
                    <ExternalLink class="size-4" />
                    Open in Editor
                  </UiButton>
                </NuxtLink>
              </div>
            </div>
          </UiCardContent>
        </UiCard>

        <!-- Footer info -->
        <div class="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
          <div class="flex items-center gap-2">
            <span>Shared by</span>
            <UiAvatar class="size-5">
              <UiAvatarImage v-if="shareData.creator?.image" :src="shareData.creator.image" />
              <UiAvatarFallback class="text-[10px]">
                {{ shareData.creator?.name?.[0]?.toUpperCase() || "?" }}
              </UiAvatarFallback>
            </UiAvatar>
            <span class="font-medium text-foreground">{{ shareData.creator?.name }}</span>
          </div>
          <span>View only</span>
        </div>
      </div>
    </main>
  </div>
</template>
