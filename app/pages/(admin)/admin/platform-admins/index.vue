<script setup lang="ts">
import { toast } from "vue-sonner"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"
import type { PlatformAdminTier, PlatformAdminListItem } from "@shared/auth/plugins/platform-admin.client"
import type { FormBuilder } from "~/components/ui/FormBuilder/FormBuilder.vue"

definePageMeta({
  layout: "admin",
  middleware: ["admin"]
})

useSeoMeta({ title: "Platform Admins - Admin" })

// Check if user is owner
const { isPlatformOwner } = usePermissions()

// State
const admins = ref<PlatformAdminListItem[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

// Grant dialog state
const showGrantDialog = ref(false)
const isGranting = ref(false)

// Grant form schema and configuration
const grantFormSchema = toTypedSchema(
  z.object({
    tier: z.enum(["viewer", "support", "admin"]),
    notes: z.string().optional()
  })
)

const grantForm = useForm({
  validationSchema: grantFormSchema,
  initialValues: {
    tier: "viewer" as const,
    notes: ""
  }
})

const grantFormFields: FormBuilder[] = [
  {
    variant: "Select",
    name: "tier",
    label: "Tier",
    options: [
      { value: "viewer", label: "Viewer - Read-only access" },
      { value: "support", label: "Support - Ban, impersonate, view data" },
      { value: "admin", label: "Admin - Full access, delete users/orgs" }
    ],
    wrapperClass: "space-y-2"
  },
  {
    variant: "Textarea",
    name: "notes",
    label: "Notes (optional)",
    placeholder: "Reason for granting access...",
    wrapperClass: "space-y-2"
  }
]

// Selected user for grant dialog
const selectedUserId = ref("")

// Update tier dialog state
const showUpdateDialog = ref(false)
const updateAdmin = ref<PlatformAdminListItem | null>(null)
const isUpdating = ref(false)

// Update tier form schema and configuration
const updateFormSchema = toTypedSchema(
  z.object({
    tier: z.enum(["viewer", "support", "admin"])
  })
)

const updateForm = useForm({
  validationSchema: updateFormSchema,
  initialValues: {
    tier: "viewer" as const
  }
})

const updateFormFields: FormBuilder[] = [
  {
    variant: "Select",
    name: "tier",
    label: "New Tier",
    options: [
      { value: "viewer", label: "Viewer - Read-only access" },
      { value: "support", label: "Support - Ban, impersonate, view data" },
      { value: "admin", label: "Admin - Full access, delete users/orgs" }
    ],
    wrapperClass: "space-y-2"
  }
]

// Revoke dialog state
const showRevokeDialog = ref(false)
const revokeAdmin = ref<PlatformAdminListItem | null>(null)
const isRevoking = ref(false)

// Fetch admins
const fetchAdmins = async () => {
  isLoading.value = true
  error.value = null
  try {
    const response = await authClient.platformAdmin.list()
    admins.value = (response.data?.admins ?? []) as PlatformAdminListItem[]
  } catch (e: any) {
    error.value = e.message || "Failed to load platform admins"
  } finally {
    isLoading.value = false
  }
}

// Grant platform admin access
const handleGrant = grantForm.handleSubmit(async (values) => {
  if (!selectedUserId.value) {
    toast.error("Please select a user")
    return
  }

  isGranting.value = true
  try {
    await authClient.platformAdmin.grant({
      userId: selectedUserId.value,
      tier: values.tier,
      notes: values.notes || undefined
    })
    toast.success("Platform admin access granted")
    showGrantDialog.value = false
    grantForm.resetForm()
    selectedUserId.value = ""
    await fetchAdmins()
  } catch (e: any) {
    toast.error(e.message || "Failed to grant access")
  } finally {
    isGranting.value = false
  }
})

// Update tier
const openUpdateDialog = (admin: PlatformAdminListItem) => {
  updateAdmin.value = admin
  const tier = admin.tier === "owner" ? "admin" : (admin.tier as Exclude<PlatformAdminTier, "owner">)
  updateForm.setFieldValue("tier", tier)
  showUpdateDialog.value = true
}

const handleUpdateTier = updateForm.handleSubmit(async (values) => {
  if (!updateAdmin.value) return

  isUpdating.value = true
  try {
    await authClient.platformAdmin.updateTier({
      userId: updateAdmin.value.user?.id ?? "",
      tier: values.tier
    })
    toast.success("Tier updated successfully")
    showUpdateDialog.value = false
    updateAdmin.value = null
    updateForm.resetForm()
    await fetchAdmins()
  } catch (e: any) {
    toast.error(e.message || "Failed to update tier")
  } finally {
    isUpdating.value = false
  }
})

// Revoke access
const openRevokeDialog = (admin: PlatformAdminListItem) => {
  revokeAdmin.value = admin
  showRevokeDialog.value = true
}

const handleRevoke = async () => {
  if (!revokeAdmin.value?.user) return

  isRevoking.value = true
  try {
    await authClient.platformAdmin.revoke({
      userId: revokeAdmin.value.user.id
    })
    toast.success("Platform admin access revoked")
    showRevokeDialog.value = false
    revokeAdmin.value = null
    await fetchAdmins()
  } catch (e: any) {
    toast.error(e.message || "Failed to revoke access")
  } finally {
    isRevoking.value = false
  }
}

// Format date
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

// Tier badge variant
const getTierBadgeVariant = (tier: PlatformAdminTier) => {
  switch (tier) {
    case "owner":
      return "default"
    case "admin":
      return "destructive"
    case "support":
      return "secondary"
    default:
      return "outline"
  }
}

// Redirect if not owner
watch(
  isPlatformOwner,
  (isOwner) => {
    if (isOwner === false) {
      toast.error("Only the platform owner can manage platform admins")
      navigateTo("/admin")
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (isPlatformOwner.value) {
    fetchAdmins()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Platform Admins</h1>
        <p class="text-muted-foreground mt-1">Manage who has access to the admin panel</p>
      </div>
      <UiButton @click="showGrantDialog = true">
        <Icon name="lucide:user-plus" class="size-4 mr-2" />
        Add Admin
      </UiButton>
    </div>

    <!-- Info Alert -->
    <UiAlert>
      <Icon name="lucide:info" class="size-4" />
      <UiAlertTitle>Platform Admin Tiers</UiAlertTitle>
      <UiAlertDescription>
        <ul class="list-disc list-inside mt-2 space-y-1 text-sm">
          <li><strong>Owner:</strong> Full control, only one exists, can manage all platform admins</li>
          <li><strong>Admin:</strong> Full platform access, can delete users and organizations</li>
          <li><strong>Support:</strong> Can view data, ban/unban users, and impersonate users</li>
          <li><strong>Viewer:</strong> Read-only access to dashboards and reports</li>
        </ul>
      </UiAlertDescription>
    </UiAlert>

    <!-- Error state -->
    <UiAlert v-if="error" variant="destructive">
      <Icon name="lucide:alert-circle" class="size-4" />
      <UiAlertTitle>Error</UiAlertTitle>
      <UiAlertDescription>{{ error }}</UiAlertDescription>
    </UiAlert>

    <!-- Admins Table -->
    <UiCard>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-4 font-medium">User</th>
              <th class="text-left p-4 font-medium">Tier</th>
              <th class="text-left p-4 font-medium">Granted By</th>
              <th class="text-left p-4 font-medium">Granted At</th>
              <th class="text-right p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading state -->
            <template v-if="isLoading">
              <tr v-for="i in 3" :key="i" class="border-b">
                <td class="p-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full bg-muted animate-pulse" />
                    <div class="space-y-1">
                      <div class="h-4 w-32 bg-muted rounded animate-pulse" />
                      <div class="h-3 w-48 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </td>
                <td class="p-4"><div class="h-6 w-20 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-32 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                <td class="p-4"><div class="h-8 w-16 bg-muted rounded animate-pulse ml-auto" /></td>
              </tr>
            </template>

            <!-- Empty state -->
            <tr v-else-if="admins.length === 0">
              <td colspan="5" class="p-8 text-center text-muted-foreground">
                <Icon name="lucide:shield" class="size-12 mx-auto mb-4 opacity-50" />
                <p>No platform admins found</p>
              </td>
            </tr>

            <!-- Admin rows -->
            <tr v-for="admin in admins" v-else :key="admin.id" class="border-b hover:bg-muted/50 transition-colors">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-10">
                    <UiAvatarImage v-if="admin.user?.image" :src="admin.user.image" :alt="admin.user?.name" />
                    <UiAvatarFallback>{{
                      (admin.user?.name || admin.user?.email)?.[0]?.toUpperCase()
                    }}</UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">{{ admin.user?.name || "Unknown" }}</p>
                    <p class="text-xs text-muted-foreground">{{ admin.user?.email }}</p>
                  </div>
                </div>
              </td>
              <td class="p-4">
                <UiBadge :variant="getTierBadgeVariant(admin.tier)">{{ admin.tier }}</UiBadge>
              </td>
              <td class="p-4 text-muted-foreground">
                {{ admin.grantedBy?.name || "System" }}
              </td>
              <td class="p-4 text-muted-foreground">
                {{ formatDate(admin.grantedAt) }}
              </td>
              <td class="p-4 text-right">
                <div v-if="admin.tier !== 'owner'" class="flex items-center justify-end gap-2">
                  <UiButton variant="ghost" size="sm" @click="openUpdateDialog(admin)">
                    <Icon name="lucide:edit" class="size-4" />
                  </UiButton>
                  <UiButton variant="ghost" size="sm" class="text-destructive" @click="openRevokeDialog(admin)">
                    <Icon name="lucide:trash-2" class="size-4" />
                  </UiButton>
                </div>
                <span v-else class="text-xs text-muted-foreground">Protected</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <!-- Grant Dialog -->
    <UiDialog v-model:open="showGrantDialog">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>Grant Platform Admin Access</UiDialogTitle>
          <UiDialogDescription>Search for a user and select their access tier.</UiDialogDescription>
        </UiDialogHeader>
        <form class="space-y-4 py-4" @submit="handleGrant">
          <div class="space-y-2">
            <UiLabel>User</UiLabel>
            <AdminUserSearch v-model="selectedUserId" placeholder="Search for a user..." />
          </div>
          <UiFormBuilder :fields="grantFormFields" />
        </form>
        <UiDialogFooter>
          <UiButton variant="outline" @click="showGrantDialog = false">Cancel</UiButton>
          <UiButton :disabled="isGranting || !selectedUserId" @click="handleGrant">
            <Icon v-if="isGranting" name="lucide:loader-2" class="size-4 mr-2 animate-spin" />
            Grant Access
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Update Tier Dialog -->
    <UiDialog v-model:open="showUpdateDialog">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>Update Admin Tier</UiDialogTitle>
          <UiDialogDescription>
            Change the tier for {{ updateAdmin?.user?.name || updateAdmin?.user?.email }}
          </UiDialogDescription>
        </UiDialogHeader>
        <form class="space-y-4 py-4" @submit="handleUpdateTier">
          <UiFormBuilder :fields="updateFormFields" />
        </form>
        <UiDialogFooter>
          <UiButton variant="outline" @click="showUpdateDialog = false">Cancel</UiButton>
          <UiButton :disabled="isUpdating" @click="handleUpdateTier">
            <Icon v-if="isUpdating" name="lucide:loader-2" class="size-4 mr-2 animate-spin" />
            Update Tier
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>

    <!-- Revoke Dialog -->
    <UiAlertDialog v-model:open="showRevokeDialog">
      <UiAlertDialogContent>
        <UiAlertDialogHeader>
          <UiAlertDialogTitle>Revoke Platform Admin Access</UiAlertDialogTitle>
          <UiAlertDialogDescription>
            Are you sure you want to revoke platform admin access for
            <strong>{{ revokeAdmin?.user?.name || revokeAdmin?.user?.email }}</strong
            >? They will lose all admin privileges.
          </UiAlertDialogDescription>
        </UiAlertDialogHeader>
        <UiAlertDialogFooter>
          <UiAlertDialogCancel :disabled="isRevoking">Cancel</UiAlertDialogCancel>
          <UiButton variant="destructive" :disabled="isRevoking" @click="handleRevoke">
            <Icon v-if="isRevoking" name="lucide:loader-2" class="size-4 mr-2 animate-spin" />
            Revoke Access
          </UiButton>
        </UiAlertDialogFooter>
      </UiAlertDialogContent>
    </UiAlertDialog>
  </div>
</template>
