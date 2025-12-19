<script setup lang="ts">
import { toast } from "vue-sonner"

const session = authClient.useSession()
const user = computed(() => session.value?.data?.user)

useSeoMeta({ title: "Profile Settings" })

// Form state
const isLoading = ref(false)
const firstName = ref("")
const lastName = ref("")
const name = ref("")

// Initialize form with user data
watch(
  user,
  (userData) => {
    if (userData) {
      firstName.value = userData.firstName || ""
      lastName.value = userData.lastName || ""
      name.value = userData.name || ""
    }
  },
  { immediate: true }
)

// Update profile
const handleUpdateProfile = async () => {
  if (!firstName.value.trim() || !lastName.value.trim()) {
    toast.error("First name and last name are required")
    return
  }

  isLoading.value = true
  try {
    await authClient.updateUser({
      name: `${firstName.value} ${lastName.value}`,
      firstName: firstName.value,
      lastName: lastName.value
    })

    toast.success("Profile updated successfully")
  } catch (error: any) {
    toast.error(error.message || "Failed to update profile")
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <UiButton variant="ghost" size="icon" to="/settings">
        <Icon name="lucide:arrow-left" class="size-4" />
      </UiButton>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Profile</h1>
        <p class="text-muted-foreground">Manage your personal information</p>
      </div>
    </div>

    <!-- Profile Form -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Personal Information</UiCardTitle>
        <UiCardDescription>Update your name and profile details</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <!-- Avatar -->
        <div class="flex items-center gap-4">
          <UiAvatar class="size-20">
            <UiAvatarImage v-if="user?.image" :src="user.image" />
            <UiAvatarFallback class="text-xl">
              {{ user?.name?.[0]?.toUpperCase() || "?" }}
            </UiAvatarFallback>
          </UiAvatar>
          <div>
            <p class="text-sm font-medium">Profile Picture</p>
            <p class="text-xs text-muted-foreground">Avatar customization coming soon</p>
          </div>
        </div>

        <UiDivider />

        <!-- Name Fields -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <UiLabel for="firstName">First Name</UiLabel>
            <UiInput
              id="firstName"
              v-model="firstName"
              placeholder="John"
              :disabled="isLoading"
            />
          </div>
          <div class="space-y-2">
            <UiLabel for="lastName">Last Name</UiLabel>
            <UiInput
              id="lastName"
              v-model="lastName"
              placeholder="Doe"
              :disabled="isLoading"
            />
          </div>
        </div>

        <!-- Email (read-only) -->
        <div class="space-y-2">
          <UiLabel for="email">Email Address</UiLabel>
          <UiInput id="email" :model-value="user?.email" disabled />
          <p class="text-xs text-muted-foreground">
            Email cannot be changed. Contact support if you need to update your email.
          </p>
        </div>
      </UiCardContent>
      <UiCardFooter class="flex justify-end gap-2">
        <UiButton variant="outline" to="/settings" :disabled="isLoading">
          Cancel
        </UiButton>
        <UiButton :disabled="isLoading" @click="handleUpdateProfile">
          <Icon v-if="isLoading" name="svg-spinners:ring-resize" class="size-4" />
          Save Changes
        </UiButton>
      </UiCardFooter>
    </UiCard>

    <!-- Account Info -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Account Information</UiCardTitle>
        <UiCardDescription>Details about your account</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b">
          <span class="text-sm text-muted-foreground">Account ID</span>
          <code class="text-xs bg-muted px-2 py-1 rounded">{{ user?.id?.slice(0, 12) }}...</code>
        </div>
        <div class="flex items-center justify-between py-2 border-b">
          <span class="text-sm text-muted-foreground">Email Verified</span>
          <UiBadge :variant="user?.emailVerified ? 'default' : 'secondary'">
            {{ user?.emailVerified ? "Verified" : "Not Verified" }}
          </UiBadge>
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-muted-foreground">Account Created</span>
          <span class="text-sm">
            {{ user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-" }}
          </span>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
