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
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 scale-95 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-2"
    >
      <div
        v-if="isImpersonating"
        class="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full pl-3.5 pr-1 py-1 shadow-lg"
      >
        <div class="flex items-center gap-2">
          <Icon name="lucide:eye" class="size-4" />
          <span class="text-sm font-medium">
            Viewing as <span class="font-semibold">{{ impersonatedUser?.name || impersonatedUser?.email }}</span>
          </span>
        </div>
        <button
          class="inline-flex items-center justify-center size-7 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          :disabled="isLoading"
          title="Stop impersonating"
          @click="handleStopImpersonating"
        >
          <Icon v-if="isLoading" name="lucide:loader-2" class="size-3.5 animate-spin" />
          <Icon v-else name="lucide:x" class="size-3.5" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
