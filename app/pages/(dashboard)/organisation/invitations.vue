<script setup lang="ts">
import { toast } from "vue-sonner"

const { activeOrg, isOrgAdmin, workspaceName, hasActiveOrganization, isLoading } = useActiveOrganization()

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

const showInviteDialog = ref(false)
const isCancelling = ref<string | null>(null)

// Fetch invitations
const {
  data: invitations,
  status: invitationsStatus,
  refresh: refreshInvitations
} = await useAsyncData(
  () => (activeOrg.value?.data?.id ? `invitations-${activeOrg.value.data.id}` : "invitations"),
  async () => {
    if (!activeOrg.value?.data?.id) return []
    const result = await authClient.organization.listInvitations({
      query: { organizationId: activeOrg.value.data.id }
    })
    if (result.error) {
      throw new Error(result.error.message)
    }
    return result.data || []
  },
  { server: false, watch: [() => activeOrg.value?.data?.id] }
)

// Cancel invitation
const handleCancelInvitation = async (invitationId: string, email: string) => {
  if (!confirm(`Are you sure you want to cancel the invitation to ${email}?`)) {
    return
  }

  isCancelling.value = invitationId
  try {
    const result = await authClient.organization.cancelInvitation({
      invitationId
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to cancel invitation")
      return
    }

    toast.success("Invitation cancelled")
    await refreshInvitations()
  } catch (error: any) {
    toast.error(error.message || "Failed to cancel invitation")
  } finally {
    isCancelling.value = null
  }
}

// Format status
const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return { variant: "secondary" as const, label: "Pending" }
    case "accepted":
      return { variant: "default" as const, label: "Accepted" }
    case "rejected":
      return { variant: "destructive" as const, label: "Rejected" }
    case "canceled":
      return { variant: "outline" as const, label: "Cancelled" }
    default:
      return { variant: "outline" as const, label: status }
  }
}

useSeoMeta({
  title: computed(() => `Invitations - ${workspaceName.value}`)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Invitations</h1>
        <p class="text-muted-foreground">Manage pending invitations to your workplace</p>
      </div>
      <UiButton @click="showInviteDialog = true">
        <Icon name="lucide:user-plus" class="size-4" />
        Invite Member
      </UiButton>
    </div>

    <!-- Invitations Table -->
    <UiCard>
      <UiCardContent class="p-0">
        <!-- Loading state -->
        <div v-if="invitationsStatus === 'pending'" class="flex items-center justify-center py-12">
          <Icon name="svg-spinners:ring-resize" class="size-8 text-primary" />
        </div>

        <!-- Invitations list -->
        <UiTable v-else>
          <UiTableHeader>
            <UiTableRow>
              <UiTableHead class="w-[300px]">Email</UiTableHead>
              <UiTableHead>Role</UiTableHead>
              <UiTableHead>Status</UiTableHead>
              <UiTableHead>Sent</UiTableHead>
              <UiTableHead>Expires</UiTableHead>
              <UiTableHead class="text-right">Actions</UiTableHead>
            </UiTableRow>
          </UiTableHeader>
          <UiTableBody>
            <UiTableRow v-for="invitation in invitations" :key="invitation.id">
              <UiTableCell>
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-9">
                    <UiAvatarFallback>
                      {{ invitation.email[0]?.toUpperCase() || "?" }}
                    </UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">{{ invitation.email }}</p>
                  </div>
                </div>
              </UiTableCell>
              <UiTableCell>
                <UiBadge variant="outline" class="capitalize">
                  {{ invitation.role }}
                </UiBadge>
              </UiTableCell>
              <UiTableCell>
                <UiBadge :variant="getStatusBadge(invitation.status).variant">
                  {{ getStatusBadge(invitation.status).label }}
                </UiBadge>
              </UiTableCell>
              <UiTableCell>
                {{ invitation.createdAt ? new Date(invitation.createdAt).toLocaleDateString() : "-" }}
              </UiTableCell>
              <UiTableCell>
                {{ invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : "-" }}
              </UiTableCell>
              <UiTableCell class="text-right">
                <template v-if="invitation.status === 'pending'">
                  <UiButton
                    variant="ghost"
                    size="sm"
                    :disabled="isCancelling === invitation.id"
                    @click="handleCancelInvitation(invitation.id, invitation.email)"
                  >
                    <Icon v-if="isCancelling === invitation.id" name="svg-spinners:ring-resize" class="size-4" />
                    <Icon v-else name="lucide:x" class="size-4" />
                    Cancel
                  </UiButton>
                </template>
                <span v-else class="text-sm text-muted-foreground">-</span>
              </UiTableCell>
            </UiTableRow>

            <UiTableRow v-if="invitations?.length === 0">
              <UiTableCell colspan="6" class="h-24 text-center">
                <div class="flex flex-col items-center gap-2">
                  <Icon name="lucide:mail" class="size-8 text-muted-foreground" />
                  <p class="text-muted-foreground">No invitations found</p>
                  <UiButton variant="outline" size="sm" @click="showInviteDialog = true">
                    Invite your first team member
                  </UiButton>
                </div>
              </UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </UiCardContent>
    </UiCard>

    <!-- Invite Dialog -->
    <OrganisationInviteDialog v-model:open="showInviteDialog" @invited="refreshInvitations" />
  </div>
</template>
