<script setup lang="ts">
import { toast } from "vue-sonner"

const { activeOrg, isOrgAdmin, isOrgOwner, workspaceName, hasActiveOrganization, isLoading } = useActiveOrganization()

// Redirect if no org or not admin (only after loading completes)
watch(
  [hasActiveOrganization, isOrgAdmin, isLoading],
  ([hasOrg, admin, loading]) => {
    if (loading) return
    if (!hasOrg) {
      navigateTo("/")
    } else if (!admin) {
      navigateTo("/organisation")
    }
  },
  { immediate: true }
)

// Form state
const orgData = computed(() => activeOrg.value?.data)
const orgName = ref("")
const orgSlug = ref("")
const isUpdating = ref(false)
const isDeleting = ref(false)
const showDeleteDialog = ref(false)
const deleteConfirmation = ref("")

// Initialize form with org data
watch(
  orgData,
  (data) => {
    if (data) {
      orgName.value = data.name || ""
      orgSlug.value = data.slug || ""
    }
  },
  { immediate: true }
)

// Update organization
const handleUpdateOrg = async () => {
  if (!orgName.value.trim()) {
    toast.error("Organization name is required")
    return
  }

  isUpdating.value = true
  try {
    const result = await authClient.organization.update({
      data: {
        name: orgName.value.trim()
      }
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to update organization")
      return
    }

    toast.success("Organization updated successfully")
  } catch (error: any) {
    toast.error(error.message || "Failed to update organization")
  } finally {
    isUpdating.value = false
  }
}

// Delete organization (owner only)
const handleDeleteOrg = async () => {
  if (deleteConfirmation.value !== orgData.value?.name) {
    toast.error("Please type the organization name to confirm deletion")
    return
  }

  isDeleting.value = true
  try {
    const result = await authClient.organization.delete({
      organizationId: orgData.value?.id || ""
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to delete organization")
      return
    }

    toast.success("Organization deleted successfully")
    showDeleteDialog.value = false
    await navigateTo("/")
  } catch (error: any) {
    toast.error(error.message || "Failed to delete organization")
  } finally {
    isDeleting.value = false
  }
}

useSeoMeta({
  title: computed(() => `Settings - ${workspaceName.value}`)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Organization Settings</h1>
      <p class="text-muted-foreground">Manage your organization's settings and preferences</p>
    </div>

    <!-- General Settings -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>General</UiCardTitle>
        <UiCardDescription> Basic information about your organization </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="space-y-2">
          <UiLabel for="orgName">Organization Name</UiLabel>
          <UiInput id="orgName" v-model="orgName" placeholder="Acme Construction Co." :disabled="isUpdating" />
        </div>

        <div class="space-y-2">
          <UiLabel for="orgSlug">Organization Slug</UiLabel>
          <UiInput id="orgSlug" v-model="orgSlug" placeholder="acme-construction" disabled />
          <p class="text-xs text-muted-foreground">The slug cannot be changed after creation</p>
        </div>
      </UiCardContent>
      <UiCardFooter>
        <UiButton :disabled="isUpdating || !orgName.trim()" @click="handleUpdateOrg">
          <Icon v-if="isUpdating" name="svg-spinners:ring-resize" class="size-4" />
          Save Changes
        </UiButton>
      </UiCardFooter>
    </UiCard>

    <!-- Logo Settings -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Organization Logo</UiCardTitle>
        <UiCardDescription> Upload a logo for your organization </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="flex items-center gap-6">
          <div class="flex size-20 items-center justify-center rounded-lg border-2 border-dashed bg-muted">
            <img v-if="orgData?.logo" :src="orgData.logo" :alt="orgData.name" class="size-12 rounded object-cover" />
            <Icon v-else name="lucide:building-2" class="size-10 text-muted-foreground" />
          </div>
          <div class="space-y-2">
            <UiButton variant="outline" disabled>
              <Icon name="lucide:upload" class="size-4" />
              Upload Logo
            </UiButton>
            <p class="text-xs text-muted-foreground">PNG, JPG up to 2MB. Coming soon.</p>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Danger Zone (Owner only) -->
    <UiCard v-if="isOrgOwner" class="border-destructive">
      <UiCardHeader>
        <UiCardTitle class="text-destructive">Danger Zone</UiCardTitle>
        <UiCardDescription> Irreversible actions that will permanently affect your organization </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div>
            <h4 class="font-medium">Delete Organization</h4>
            <p class="text-sm text-muted-foreground">Permanently delete this organization and all its data</p>
          </div>
          <UiButton variant="destructive" @click="showDeleteDialog = true"> Delete Organization </UiButton>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Delete Confirmation Dialog -->
    <UiDialog v-model:open="showDeleteDialog">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle class="text-destructive">Delete Organization</UiDialogTitle>
          <UiDialogDescription>
            This action cannot be undone. This will permanently delete the organization
            <span class="font-semibold">{{ orgData?.name }}</span> and remove all associated data.
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-4 py-4">
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <ul class="list-inside list-disc space-y-1 text-sm text-destructive">
              <li>All organization members will lose access</li>
              <li>All shared projects will be deleted</li>
              <li>All pending invitations will be cancelled</li>
              <li>This action is irreversible</li>
            </ul>
          </div>

          <div class="space-y-2">
            <UiLabel for="deleteConfirm">
              Type <span class="font-semibold">{{ orgData?.name }}</span> to confirm
            </UiLabel>
            <UiInput
              id="deleteConfirm"
              v-model="deleteConfirmation"
              :placeholder="orgData?.name"
              :disabled="isDeleting"
            />
          </div>
        </div>

        <UiDialogFooter>
          <UiButton variant="outline" :disabled="isDeleting" @click="showDeleteDialog = false"> Cancel </UiButton>
          <UiButton
            variant="destructive"
            :disabled="isDeleting || deleteConfirmation !== orgData?.name"
            @click="handleDeleteOrg"
          >
            <Icon v-if="isDeleting" name="svg-spinners:ring-resize" class="size-4" />
            Delete Organization
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
