<script setup lang="ts">
import { toast } from "vue-sonner"
import { Building2, Upload } from "lucide-vue-next"

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
    toast.error("Workplace name is required")
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
      toast.error(result.error.message || "Failed to update workplace")
      return
    }

    toast.success("Workplace updated successfully")
  } catch (error: any) {
    toast.error(error.message || "Failed to update workplace")
  } finally {
    isUpdating.value = false
  }
}

// Delete organization (owner only)
const handleDeleteOrg = async () => {
  if (deleteConfirmation.value !== orgData.value?.name) {
    toast.error("Please type the workplace name to confirm deletion")
    return
  }

  isDeleting.value = true
  try {
    const result = await authClient.organization.delete({
      organizationId: orgData.value?.id || ""
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to delete workplace")
      return
    }

    toast.success("Workplace deleted successfully")
    showDeleteDialog.value = false
    await navigateTo("/")
  } catch (error: any) {
    toast.error(error.message || "Failed to delete workplace")
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
      <h1 class="text-2xl font-bold tracking-tight">Workplace Settings</h1>
      <p class="text-muted-foreground">Manage your workplace's settings and preferences</p>
    </div>

    <!-- General Settings -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>General</UiCardTitle>
        <UiCardDescription> Basic information about your workplace </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="space-y-2">
          <UiLabel for="orgName">Workplace Name</UiLabel>
          <UiInput id="orgName" v-model="orgName" placeholder="Acme Construction Co." :disabled="isUpdating" />
        </div>

        <div class="space-y-2">
          <UiLabel for="orgSlug">Workplace Slug</UiLabel>
          <UiInput id="orgSlug" v-model="orgSlug" placeholder="acme-construction" disabled />
          <p class="text-xs text-muted-foreground">The slug cannot be changed after creation</p>
        </div>
      </UiCardContent>
      <UiCardFooter>
        <UiButton :disabled="isUpdating || !orgName.trim()" @click="handleUpdateOrg">
          <UiSpinner v-if="isUpdating" class="size-4" />
          Save Changes
        </UiButton>
      </UiCardFooter>
    </UiCard>

    <!-- Logo Settings -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Workplace Logo</UiCardTitle>
        <UiCardDescription> Upload a logo for your workplace </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="flex items-center gap-6">
          <div class="flex size-20 items-center justify-center rounded-lg border-2 border-dashed bg-muted">
            <img v-if="orgData?.logo" :src="orgData.logo" :alt="orgData.name" class="size-12 rounded object-cover" />
            <Building2 v-else class="size-10 text-muted-foreground" />
          </div>
          <div class="space-y-2">
            <UiButton variant="outline" disabled>
              <Upload class="size-4" />
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
        <UiCardDescription> Irreversible actions that will permanently affect your workplace </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div>
            <h4 class="font-medium">Delete Workplace</h4>
            <p class="text-sm text-muted-foreground">Permanently delete this workplace and all its data</p>
          </div>
          <UiButton variant="destructive" @click="showDeleteDialog = true"> Delete Workplace </UiButton>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Delete Confirmation Dialog -->
    <UiDialog v-model:open="showDeleteDialog">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle class="text-destructive">Delete Workplace</UiDialogTitle>
          <UiDialogDescription>
            This action cannot be undone. This will permanently delete the workplace
            <span class="font-semibold">{{ orgData?.name }}</span> and remove all associated data.
          </UiDialogDescription>
        </UiDialogHeader>

        <div class="space-y-4 py-4">
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <ul class="list-inside list-disc space-y-1 text-sm text-destructive">
              <li>All workplace members will lose access</li>
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
            <UiSpinner v-if="isDeleting" class="size-4" />
            Delete Workplace
          </UiButton>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
