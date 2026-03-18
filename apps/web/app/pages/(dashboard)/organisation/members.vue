<script setup lang="ts">
import { toast } from "vue-sonner"
import { MoreHorizontal, Shield, User, UserMinus, UserPlus } from "lucide-vue-next"

const { activeOrg, isOrgAdmin, isOrgOwner, workspaceName, hasActiveOrganization, currentMember, isLoading } =
  useActiveOrganization()

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
const isUpdatingRole = ref<string | null>(null)
const isRemovingMember = ref<string | null>(null)

// Get members from active org
const members = computed(() => activeOrg.value?.data?.members || [])

// Update member role
const handleUpdateRole = async (memberId: string, newRole: "member" | "admin") => {
  isUpdatingRole.value = memberId
  try {
    const result = await authClient.organization.updateMemberRole({
      memberId,
      role: newRole
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to update role")
      return
    }

    toast.success("Member role updated")
  } catch (error: any) {
    toast.error(error.message || "Failed to update role")
  } finally {
    isUpdatingRole.value = null
  }
}

// Remove member
const handleRemoveMember = async (memberId: string, memberEmail: string) => {
  if (!confirm(`Are you sure you want to remove ${memberEmail} from the workplace?`)) {
    return
  }

  isRemovingMember.value = memberId
  try {
    const result = await authClient.organization.removeMember({
      memberIdOrEmail: memberId
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to remove member")
      return
    }

    toast.success("Member removed from workplace")
  } catch (error: any) {
    toast.error(error.message || "Failed to remove member")
  } finally {
    isRemovingMember.value = null
  }
}

// Can user manage this member?
const canManageMember = (member: (typeof members.value)[0]) => {
  // Owners can't be managed
  if (member.role === "owner") return false
  // Only owners can manage admins
  if (member.role === "admin" && !isOrgOwner.value) return false
  // Can't manage yourself
  if (member.id === currentMember.value?.id) return false
  return true
}

useSeoMeta({
  title: computed(() => `Members - ${workspaceName.value}`)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Team Members</h1>
        <p class="text-muted-foreground">Manage your workplace's team members</p>
      </div>
      <UiButton @click="showInviteDialog = true">
        <UserPlus class="size-4" />
        Invite Member
      </UiButton>
    </div>

    <!-- Members Table -->
    <UiCard>
      <UiCardContent class="p-0">
        <UiTable>
          <UiTableHeader>
            <UiTableRow>
              <UiTableHead class="w-[300px]">Member</UiTableHead>
              <UiTableHead>Role</UiTableHead>
              <UiTableHead>Joined</UiTableHead>
              <UiTableHead class="text-right">Actions</UiTableHead>
            </UiTableRow>
          </UiTableHeader>
          <UiTableBody>
            <UiTableRow v-for="member in members" :key="member.id">
              <UiTableCell>
                <div class="flex items-center gap-3">
                  <UiAvatar class="size-9">
                    <UiAvatarImage v-if="member.user?.image" :src="member.user.image" />
                    <UiAvatarFallback>
                      {{ member.user?.name?.[0]?.toUpperCase() || "?" }}
                    </UiAvatarFallback>
                  </UiAvatar>
                  <div>
                    <p class="font-medium">
                      {{ member.user?.name || "Unknown" }}
                      <span v-if="member.id === currentMember?.id" class="ml-1 text-xs text-muted-foreground"
                        >(you)</span
                      >
                    </p>
                    <p class="text-sm text-muted-foreground">{{ member.user?.email }}</p>
                  </div>
                </div>
              </UiTableCell>
              <UiTableCell>
                <UiBadge
                  :variant="member.role === 'owner' ? 'default' : member.role === 'admin' ? 'secondary' : 'outline'"
                  class="capitalize"
                >
                  {{ member.role }}
                </UiBadge>
              </UiTableCell>
              <UiTableCell>
                {{ member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "-" }}
              </UiTableCell>
              <UiTableCell class="text-right">
                <template v-if="canManageMember(member)">
                  <UiDropdownMenu>
                    <UiDropdownMenuTrigger as-child>
                      <UiButton variant="ghost" size="icon">
                        <MoreHorizontal class="size-4" />
                      </UiButton>
                    </UiDropdownMenuTrigger>
                    <UiDropdownMenuContent align="end">
                      <UiDropdownMenuLabel>Actions</UiDropdownMenuLabel>
                      <UiDropdownMenuSeparator />

                      <!-- Role change options -->
                      <UiDropdownMenuItem
                        v-if="member.role !== 'admin' && isOrgOwner"
                        :disabled="isUpdatingRole === member.id"
                        @click="handleUpdateRole(member.id, 'admin')"
                      >
                        <Shield class="mr-2 size-4" />
                        Make Admin
                      </UiDropdownMenuItem>
                      <UiDropdownMenuItem
                        v-if="member.role === 'admin'"
                        :disabled="isUpdatingRole === member.id"
                        @click="handleUpdateRole(member.id, 'member')"
                      >
                        <User class="mr-2 size-4" />
                        Make Member
                      </UiDropdownMenuItem>

                      <UiDropdownMenuSeparator />

                      <UiDropdownMenuItem
                        class="text-destructive focus:text-destructive"
                        :disabled="isRemovingMember === member.id"
                        @click="handleRemoveMember(member.id, member.user?.email || '')"
                      >
                        <UserMinus class="mr-2 size-4" />
                        Remove from Workplace
                      </UiDropdownMenuItem>
                    </UiDropdownMenuContent>
                  </UiDropdownMenu>
                </template>
                <span v-else class="text-sm text-muted-foreground">-</span>
              </UiTableCell>
            </UiTableRow>

            <UiTableRow v-if="members.length === 0">
              <UiTableCell colspan="4" class="h-24 text-center">
                <p class="text-muted-foreground">No members found</p>
              </UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </UiCardContent>
    </UiCard>

    <!-- Invite Dialog -->
    <OrganisationInviteDialog v-model:open="showInviteDialog" @invited="() => {}" />
  </div>
</template>
