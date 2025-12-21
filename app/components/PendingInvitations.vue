<script setup lang="ts">
import { toast } from "vue-sonner"
import { useGetApiUserInvitations, getGetApiUserInvitationsQueryKey } from "@/models/api"
import { useQueryClient } from "@tanstack/vue-query"

interface PendingInvitation {
  id: string
  email: string
  role: string
  status: string
  createdAt: string
  expiresAt: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  inviterName: string
  inviterEmail: string
}

const { switchOrganization, refreshOrganizations } = useActiveOrganization()
const queryClient = useQueryClient()

const { data: response, isPending } = useGetApiUserInvitations<{ data: PendingInvitation[] }>()

const invitations = computed(() => response.value?.data ?? [])

const refresh = () => queryClient.invalidateQueries({ queryKey: getGetApiUserInvitationsQueryKey() })

const isAccepting = ref<string | null>(null)
const isRejecting = ref<string | null>(null)

const handleAccept = async (invitation: PendingInvitation) => {
  isAccepting.value = invitation.id
  try {
    const result = await authClient.organization.acceptInvitation({
      invitationId: invitation.id
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to accept invitation")
      return
    }

    toast.success(`Welcome to ${invitation.organizationName}!`)

    // Refresh organizations list so the new org appears in the switcher
    await refreshOrganizations()

    // Switch to the new organization
    await switchOrganization(invitation.organizationId)

    // Refresh the invitations list
    await refresh()
  } catch (error: any) {
    toast.error(error.message || "Failed to accept invitation")
  } finally {
    isAccepting.value = null
  }
}

const handleReject = async (invitation: PendingInvitation) => {
  isRejecting.value = invitation.id
  try {
    const result = await authClient.organization.rejectInvitation({
      invitationId: invitation.id
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to decline invitation")
      return
    }

    toast.success("Invitation declined")
    await refresh()
  } catch (error: any) {
    toast.error(error.message || "Failed to decline invitation")
  } finally {
    isRejecting.value = null
  }
}

// Format relative time
const formatTimeAgo = (date: string) => {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return then.toLocaleDateString()
}
</script>

<template>
  <div v-if="isPending" class="animate-pulse">
    <div class="h-24 bg-muted rounded-lg" />
  </div>

  <div v-else-if="invitations.length" class="space-y-3">
    <div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <Icon name="lucide:mail" class="size-4" />
      <span>Pending Invitations</span>
      <UiBadge variant="secondary" class="ml-auto">{{ invitations.length }}</UiBadge>
    </div>

    <div class="space-y-2">
      <UiCard v-for="invite in invitations" :key="invite.id" class="border-primary/20 bg-primary/5">
        <UiCardContent class="p-4">
          <div class="flex items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon name="lucide:building-2" class="size-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">{{ invite.organizationName }}</p>
              <p class="text-sm text-muted-foreground">
                Invited by {{ invite.inviterName }} as
                <span class="font-medium capitalize">{{ invite.role }}</span>
                <span class="mx-1">·</span>
                {{ formatTimeAgo(invite.createdAt) }}
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <UiButton
                size="sm"
                :disabled="isAccepting === invite.id || isRejecting === invite.id"
                @click="handleAccept(invite)"
              >
                <Icon v-if="isAccepting === invite.id" name="svg-spinners:ring-resize" class="size-4" />
                <template v-else>
                  <Icon name="lucide:check" class="size-4" />
                  Accept
                </template>
              </UiButton>
              <UiButton
                variant="ghost"
                size="icon-sm"
                :disabled="isAccepting === invite.id || isRejecting === invite.id"
                @click="handleReject(invite)"
              >
                <Icon v-if="isRejecting === invite.id" name="svg-spinners:ring-resize" class="size-4" />
                <Icon v-else name="lucide:x" class="size-4" />
              </UiButton>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>
