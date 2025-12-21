<script setup lang="ts">
import { toast } from "vue-sonner"

// Get session to check for impersonation
const session = authClient.useSession()

// Check if current session is impersonated
const isImpersonating = computed(() => {
  const sessionData = session.value?.data?.session
  // better-auth stores impersonatedBy on the session object
  return !!(sessionData && "impersonatedBy" in sessionData && sessionData.impersonatedBy)
})

// Get the impersonated user's info
const impersonatedUser = computed(() => {
  if (!isImpersonating.value) return null
  return session.value?.data?.user
})

// Stop impersonating
const isLoading = ref(false)

const handleStopImpersonating = async () => {
  isLoading.value = true
  try {
    await authClient.admin.stopImpersonating()
    toast.success("Stopped impersonating - returning to admin account")
    // Redirect to admin panel
    navigateTo("/admin")
    // Force page refresh to update session
    window.location.reload()
  } catch (e: any) {
    toast.error(e.message || "Failed to stop impersonating")
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 -translate-y-full"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-full"
    >
      <div
        v-if="isImpersonating"
        class="fixed top-0 left-0 right-0 z-[100] bg-yellow-500 text-yellow-950 shadow-md"
      >
        <div class="container mx-auto px-4 py-2 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Icon name="lucide:user-check" class="size-5" />
            <span class="font-medium">
              You are impersonating
              <strong>{{ impersonatedUser?.name || impersonatedUser?.email }}</strong>
            </span>
          </div>
          <UiButton
            variant="outline"
            size="sm"
            class="bg-yellow-600 hover:bg-yellow-700 text-white border-yellow-600 hover:border-yellow-700"
            :disabled="isLoading"
            @click="handleStopImpersonating"
          >
            <Icon v-if="isLoading" name="lucide:loader-2" class="size-4 mr-2 animate-spin" />
            <Icon v-else name="lucide:log-out" class="size-4 mr-2" />
            Stop Impersonating
          </UiButton>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
