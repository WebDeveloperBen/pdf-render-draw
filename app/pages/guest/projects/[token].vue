<script setup lang="ts">
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"
import type { FormBuilder } from "@/components/ui/FormBuilder/FormBuilder.vue"
import { useGetApiShareToken, type GetApiShareToken200 } from "@/models/api"

definePageMeta({
  layout: "guest",
  middleware: ["guest"]
})

const route = useRoute()
const token = computed(() => {
  const params = route.params as { token?: string }
  return params.token || ""
})

// Password state - starts from URL query param if present
const passwordParam = ref((route.query.password as string) || undefined)

// Fetch the shared project data using generated API hook
const {
  data: response,
  status,
  error,
  refetch
} = useGetApiShareToken<{ data: GetApiShareToken200 }>(
  token,
  computed(() => ({ password: passwordParam.value }))
)

// Extract the actual share data
const shareData = computed(() => response.value?.data)

// Handle password-protected shares
const typedError = computed(
  () => error.value as { statusCode?: number; statusMessage?: string; message?: string } | null
)

const requiresPassword = computed(() => {
  return typedError.value?.statusCode === 400 && typedError.value?.statusMessage === "Password required for this share"
})

const errorMessage = computed(() => typedError.value?.statusMessage || typedError.value?.message || "Unknown error")

// Password form schema
const passwordSchema = toTypedSchema(
  z.object({
    password: z.string().min(1, "Please enter a password")
  })
)

const passwordForm = useForm({
  validationSchema: passwordSchema,
  initialValues: { password: "" }
})

const isSubmittingPassword = ref(false)

// FormBuilder fields for password
const passwordFields: FormBuilder[] = [
  {
    variant: "Input",
    name: "password",
    label: "Password",
    placeholder: "Enter password",
    type: "password",
    required: true,
    wrapperClass: "space-y-2"
  }
]

const submitPassword = passwordForm.handleSubmit(async (values) => {
  isSubmittingPassword.value = true

  try {
    passwordParam.value = values.password
    await refetch()

    // If still an error after refetch, it's an invalid password
    if (error.value) {
      passwordForm.setFieldError("password", typedError.value?.statusMessage || "Invalid password")
    }
  } finally {
    isSubmittingPassword.value = false
  }
})

useSeoMeta({
  title: computed(() => (shareData.value?.name ? `${shareData.value.name} - Shared Project` : "Shared Project"))
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
          <UiCardDescription> This project is password protected. Enter the password to continue. </UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <form class="space-y-4" @submit="submitPassword">
            <UiFormBuilder :fields="passwordFields" />
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
            <p class="text-sm text-muted-foreground mt-1">{{ errorMessage }}</p>
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
          <a v-if="shareData.share.allowDownload" :href="shareData.pdfUrl" target="_blank" download>
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
          <div class="aspect-4/3 overflow-hidden rounded-lg border bg-muted">
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
