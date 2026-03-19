<script setup lang="ts">
import { toast } from "vue-sonner"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"
import type { FormBuilder } from "~/components/ui/FormBuilder/FormBuilder.vue"
import { getApiAdminUsersId } from "~/models/api"
import type { GetApiAdminUsersId200 } from "~/models/api"
import { AlertCircle, AlertTriangle, ArrowLeft, Ban, Building2, CheckCircle, UserCheck, XCircle } from "lucide-vue-next"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

const route = useRoute("admin-users-id")
const userId = computed(() => route.params.id)

// Breadcrumb label
const { setLabel, clearLabel } = useBreadcrumbs()

// Permissions
const { hasPlatformAdminTier } = usePermissions()
const canBan = computed(() => hasPlatformAdminTier("support"))
const canImpersonate = computed(() => hasPlatformAdminTier("support"))

// State
const user = ref<GetApiAdminUsersId200 | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const showBanDialog = ref(false)
const isBanning = ref(false)

// Ban form schema and configuration
const banFormSchema = toTypedSchema(
  z.object({
    banReason: z.string().optional()
  })
)

const banForm = useForm({
  validationSchema: banFormSchema,
  initialValues: {
    banReason: ""
  }
})

// FormBuilder fields for ban dialog
const banFormFields: FormBuilder[] = [
  {
    variant: "Textarea",
    name: "banReason",
    label: "Reason (optional)",
    placeholder: "Enter a reason for the ban...",
    wrapperClass: "space-y-2"
  }
]

// Fetch user
const fetchUser = async () => {
  isLoading.value = true
  error.value = null
  try {
    const response = await getApiAdminUsersId(userId.value)
    user.value = response.data
  } catch (e: any) {
    error.value = e.data?.message || "Failed to load user"
  } finally {
    isLoading.value = false
  }
}

useSeoMeta({
  title: computed(() => (user.value ? `${user.value.name || user.value.email} - Admin` : "User - Admin"))
})

// Ban/unban user
const handleBan = banForm.handleSubmit(async (values) => {
  if (!user.value) return
  isBanning.value = true
  try {
    await authClient.admin.banUser({
      userId: user.value.id,
      banReason: values.banReason || undefined
    })
    toast.success("User banned successfully")
    showBanDialog.value = false
    banForm.resetForm()
    await fetchUser()
  } catch (e: any) {
    toast.error(e.message || "Failed to ban user")
  } finally {
    isBanning.value = false
  }
})

const handleUnban = async () => {
  if (!user.value) return
  isBanning.value = true
  try {
    await authClient.admin.unbanUser({
      userId: user.value.id
    })
    toast.success("User unbanned successfully")
    await fetchUser()
  } catch (e: any) {
    toast.error(e.message || "Failed to unban user")
  } finally {
    isBanning.value = false
  }
}

// Impersonate user
const handleImpersonate = async () => {
  if (!user.value) return
  try {
    const result = await authClient.admin.impersonateUser({
      userId: user.value.id
    })

    // Check for errors from better-auth
    if (result.error) {
      console.error("Impersonation error:", result.error)
      toast.error(result.error.message || "Failed to impersonate user")
      return
    }

    console.log("Impersonation result:", result.data)
    toast.success("Impersonating user - redirecting...")
    // Full page reload to clear all cached data (session, orgs, permissions)
    window.location.href = "/"
  } catch (e: any) {
    console.error("Impersonation exception:", e)
    toast.error(e.message || "Failed to impersonate user")
  }
}

// Format date
const formatDate = (date: Date | string | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

// Update breadcrumb label when user data loads
watch(
  user,
  (userData) => {
    if (userData) {
      setLabel(userId.value, userData.name || userData.email)
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchUser()
})

onUnmounted(() => {
  clearLabel(userId.value)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <UiButton variant="ghost" size="sm" @click="navigateTo('/admin/users')">
      <ArrowLeft class="size-4 mr-2" />
      Back to Users
    </UiButton>

    <!-- Loading state -->
    <div v-if="isLoading" class="space-y-6">
      <div class="flex items-center gap-4">
        <div class="size-20 rounded-full bg-muted animate-pulse" />
        <div class="space-y-2">
          <div class="h-8 w-48 bg-muted rounded animate-pulse" />
          <div class="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Error state -->
    <UiAlert v-else-if="error" variant="destructive">
      <AlertCircle class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- User details -->
    <template v-else-if="user">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-4">
          <UiAvatar class="size-20">
            <UiAvatarImage v-if="user.image" :src="user.image" :alt="user.name || 'User'" />
            <UiAvatarFallback class="text-2xl">{{ (user.name || user.email)[0]?.toUpperCase() }}</UiAvatarFallback>
          </UiAvatar>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-3xl font-bold">{{ user.name || "No name" }}</h1>
              <UiBadge v-if="user.banned" variant="destructive">Banned</UiBadge>
              <UiBadge v-else variant="outline" class="text-green-600 border-green-600">Active</UiBadge>
            </div>
            <p class="text-muted-foreground">{{ user.email }}</p>
            <p class="text-xs text-muted-foreground mt-1">ID: {{ user.id }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div v-if="canBan || canImpersonate" class="flex items-center gap-2">
          <UiButton v-if="canImpersonate && !user.banned" variant="outline" @click="handleImpersonate">
            <UserCheck class="size-4 mr-2" />
            Impersonate
          </UiButton>
          <UiButton v-if="canBan && user.banned" variant="outline" :disabled="isBanning" @click="handleUnban">
            <UserCheck class="size-4 mr-2" />
            Unban
          </UiButton>
          <UiButton
            v-if="canBan && !user.banned"
            variant="destructive"
            :disabled="isBanning"
            @click="showBanDialog = true"
          >
            <Ban class="size-4 mr-2" />
            Ban User
          </UiButton>
        </div>
      </div>

      <!-- Ban info -->
      <UiAlert v-if="user.banned && user.banReason" variant="destructive">
        <AlertTriangle class="size-4" />
        <UiAlertTitle>User is Banned</UiAlertTitle>
        <UiAlertDescription>
          <p>Reason: {{ user.banReason }}</p>
          <p v-if="user.banExpires">Expires: {{ formatDate(user.banExpires) }}</p>
        </UiAlertDescription>
      </UiAlert>

      <!-- Stats -->
      <div class="grid gap-4 md:grid-cols-4">
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Projects</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold">{{ user._count.projects }}</div>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Active Sessions</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold">{{ user._count.activeSessions }}</div>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Organizations</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="text-2xl font-bold">{{ user.memberships.length }}</div>
          </UiCardContent>
        </UiCard>
        <UiCard>
          <UiCardHeader class="pb-2">
            <UiCardTitle class="text-sm font-medium">Email Verified</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div class="flex items-center gap-2">
              <component
                :is="user.emailVerified ? CheckCircle : XCircle"
                :class="[user.emailVerified ? 'text-green-500' : 'text-red-500', 'size-6']"
              />
              <span class="text-lg">{{ user.emailVerified ? "Yes" : "No" }}</span>
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <!-- User info -->
      <div class="grid gap-6 md:grid-cols-2">
        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Account Details</UiCardTitle>
          </UiCardHeader>
          <UiCardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-sm text-muted-foreground">First Name</p>
                <p class="font-medium">{{ user.firstName || "-" }}</p>
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Last Name</p>
                <p class="font-medium">{{ user.lastName || "-" }}</p>
              </div>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Email</p>
              <p class="font-medium">{{ user.email }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Created</p>
              <p class="font-medium">{{ formatDate(user.createdAt) }}</p>
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Last Updated</p>
              <p class="font-medium">{{ formatDate(user.updatedAt) }}</p>
            </div>
          </UiCardContent>
        </UiCard>

        <UiCard>
          <UiCardHeader>
            <UiCardTitle>Organization Memberships</UiCardTitle>
          </UiCardHeader>
          <UiCardContent>
            <div v-if="user.memberships.length === 0" class="text-center py-8 text-muted-foreground">
              <Building2 class="size-12 mx-auto mb-4 opacity-50" />
              <p>No organization memberships</p>
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="membership in user.memberships"
                :key="membership.id"
                class="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-10">
                    <UiAvatarImage
                      v-if="membership.organization?.logo"
                      :src="membership.organization.logo"
                      :alt="membership.organization?.name"
                    />
                    <UiAvatarFallback>{{ membership.organization?.name?.[0]?.toUpperCase() }}</UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">{{ membership.organization?.name }}</p>
                    <p class="text-xs text-muted-foreground">@{{ membership.organization?.slug }}</p>
                  </div>
                </div>
                <UiBadge variant="secondary">{{ membership.role }}</UiBadge>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </template>

    <!-- Ban Dialog -->
    <UiAlertDialog v-model:open="showBanDialog">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>Ban User</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            Are you sure you want to ban this user? They will be logged out and unable to access the platform.
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <form class="py-4" @submit="handleBan">
          <UiFormBuilder :fields="banFormFields" />
        </form>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel :disabled="isBanning">Cancel</UiAlertDialogCancel>
          <UiButton variant="destructive" :disabled="isBanning" @click="handleBan">
            <UiSpinner v-if="isBanning" class="size-4 mr-2" />
            Ban User
          </UiButton>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </div>
</template>
