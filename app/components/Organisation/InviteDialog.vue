<script setup lang="ts">
import { toast } from "vue-sonner"

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  invited: []
}>()

const { activeOrg } = useActiveOrganization()

const email = ref("")
const role = ref<"member" | "admin">("member")
const isInviting = ref(false)

const handleInvite = async () => {
  if (!email.value.trim()) {
    toast.error("Please enter an email address")
    return
  }

  if (!activeOrg.value?.data?.id) {
    toast.error("No active organization")
    return
  }

  isInviting.value = true
  try {
    const result = await authClient.organization.inviteMember({
      email: email.value.trim(),
      role: role.value,
      organizationId: activeOrg.value.data.id
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to send invitation")
      return
    }

    toast.success(`Invitation sent to ${email.value}`)
    email.value = ""
    role.value = "member"
    emit("update:open", false)
    emit("invited")
  } catch (error: any) {
    toast.error(error.message || "Failed to send invitation")
  } finally {
    isInviting.value = false
  }
}

const handleClose = () => {
  email.value = ""
  role.value = "member"
  emit("update:open", false)
}
</script>

<template>
  <UiDialog :open="open" @update:open="emit('update:open', $event)">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>Invite Team Member</UiDialogTitle>
        <UiDialogDescription>
          Send an invitation to join {{ activeOrg?.data?.name || "this organization" }}.
        </UiDialogDescription>
      </UiDialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <UiLabel for="inviteEmail">Email Address</UiLabel>
          <UiInput
            id="inviteEmail"
            v-model="email"
            type="email"
            placeholder="colleague@company.com"
            :disabled="isInviting"
            @keyup.enter="handleInvite"
          />
        </div>

        <div class="space-y-2">
          <UiLabel for="inviteRole">Role</UiLabel>
          <UiSelect v-model="role" :disabled="isInviting">
            <UiSelectTrigger id="inviteRole">
              <UiSelectValue placeholder="Select a role" />
            </UiSelectTrigger>
            <UiSelectContent>
              <UiSelectItem value="member">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:user" class="size-4" />
                  <div>
                    <span class="font-medium">Member</span>
                    <p class="text-xs text-muted-foreground">Can view and edit projects</p>
                  </div>
                </div>
              </UiSelectItem>
              <UiSelectItem value="admin">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:shield" class="size-4" />
                  <div>
                    <span class="font-medium">Admin</span>
                    <p class="text-xs text-muted-foreground">Can manage members and settings</p>
                  </div>
                </div>
              </UiSelectItem>
            </UiSelectContent>
          </UiSelect>
        </div>
      </div>

      <UiDialogFooter>
        <UiButton variant="outline" :disabled="isInviting" @click="handleClose"> Cancel </UiButton>
        <UiButton :disabled="isInviting || !email.trim()" @click="handleInvite">
          <Icon v-if="isInviting" name="svg-spinners:ring-resize" class="size-4" />
          <Icon v-else name="lucide:send" class="size-4" />
          Send Invitation
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
