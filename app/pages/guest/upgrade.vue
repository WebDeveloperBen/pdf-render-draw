<script setup lang="ts">
import { toast } from "vue-sonner"

definePageMeta({
  layout: "guest",
  middleware: ["guest"]
})

const router = useRouter()

const firstName = ref("")
const lastName = ref("")
const isUpgrading = ref(false)
const error = ref("")

const handleUpgrade = async () => {
  error.value = ""

  if (!firstName.value.trim()) {
    error.value = "First name is required"
    return
  }

  if (!lastName.value.trim()) {
    error.value = "Last name is required"
    return
  }

  isUpgrading.value = true

  try {
    await $fetch("/api/guest/upgrade", {
      method: "POST",
      body: {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim()
      }
    })

    toast.success("Account upgraded! Welcome aboard.")

    // Redirect to main dashboard - page reload will refresh session
    window.location.href = "/"
  } catch (e: any) {
    error.value = e.data?.statusMessage || "Failed to upgrade account"
  } finally {
    isUpgrading.value = false
  }
}

useSeoMeta({
  title: "Upgrade Your Account"
})
</script>

<template>
  <div class="flex items-center justify-center py-12">
    <UiCard class="w-full max-w-md">
      <UiCardHeader class="text-center">
        <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Icon name="lucide:rocket" class="size-8 text-primary" />
        </div>
        <UiCardTitle class="text-2xl">Upgrade to Free Account</UiCardTitle>
        <UiCardDescription>
          Get your own workspace to create and manage projects
        </UiCardDescription>
      </UiCardHeader>

      <UiCardContent>
        <form class="space-y-4" @submit.prevent="handleUpgrade">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <UiLabel for="firstName">First name</UiLabel>
              <UiInput
                id="firstName"
                v-model="firstName"
                placeholder="John"
                :disabled="isUpgrading"
              />
            </div>
            <div class="space-y-2">
              <UiLabel for="lastName">Last name</UiLabel>
              <UiInput
                id="lastName"
                v-model="lastName"
                placeholder="Doe"
                :disabled="isUpgrading"
              />
            </div>
          </div>

          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

          <div class="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p class="font-medium text-sm">What you'll get:</p>
            <ul class="text-sm text-muted-foreground space-y-1">
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Your own workspace
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Create unlimited projects
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Share with your team
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Full annotation tools
              </li>
            </ul>
          </div>

          <UiButton type="submit" class="w-full" :disabled="isUpgrading">
            <Icon v-if="isUpgrading" name="svg-spinners:ring-resize" class="size-4" />
            <Icon v-else name="lucide:rocket" class="size-4" />
            Create My Free Account
          </UiButton>
        </form>
      </UiCardContent>

      <UiCardFooter class="justify-center">
        <NuxtLink to="/guest" class="text-sm text-muted-foreground hover:text-foreground">
          Maybe later
        </NuxtLink>
      </UiCardFooter>
    </UiCard>
  </div>
</template>
