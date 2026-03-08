<script setup lang="ts">
import { toast } from "vue-sonner"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"
import type { FormBuilder } from "~/components/ui/FormBuilder/FormBuilder.vue"

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  invited: []
}>()

const { activeOrg } = useActiveOrganization()

const isInviting = ref(false)

const inviteSchema = toTypedSchema(
  z.object({
    email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
    role: z.enum(["member", "admin"])
  })
)

const { handleSubmit, resetForm, values } = useForm({
  validationSchema: inviteSchema,
  initialValues: {
    email: "",
    role: "member" as const
  }
})

const formFields = computed<FormBuilder[]>(() => [
  {
    variant: "Input",
    name: "email",
    label: "Email Address",
    type: "email",
    placeholder: "colleague@company.com",
    disabled: isInviting.value,
    wrapperClass: "space-y-2"
  },
  {
    variant: "RadioCards",
    name: "role",
    label: "Select Role",
    disabled: isInviting.value,
    options: [
      {
        value: "member",
        label: "Member",
        description: "Can view and edit projects, upload files, and collaborate with the team.",
        icon: "lucide:user"
      },
      {
        value: "admin",
        label: "Admin",
        description: "Full access to manage members, settings, billing, and workplace details.",
        icon: "lucide:shield"
      }
    ]
  }
])

const handleInvite = handleSubmit(async (formValues) => {
  if (!activeOrg.value?.data?.id) {
    toast.error("No active workplace")
    return
  }

  isInviting.value = true
  try {
    const result = await authClient.organization.inviteMember({
      email: formValues.email,
      role: formValues.role,
      organizationId: activeOrg.value.data.id
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to send invitation")
      return
    }

    toast.success(`Invitation sent to ${formValues.email}`)
    resetForm()
    emit("update:open", false)
    emit("invited")
  } catch (error: any) {
    toast.error(error.message || "Failed to send invitation")
  } finally {
    isInviting.value = false
  }
})

const handleClose = () => {
  resetForm()
  emit("update:open", false)
}
</script>

<template>
  <UiDialog :open="open" @update:open="emit('update:open', $event)">
    <UiDialogContent class="sm:max-w-md">
      <!-- Header with icon -->
      <div class="flex flex-col items-start pb-2">
        <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Icon name="lucide:user-plus" class="size-7 text-primary" />
        </div>
        <UiDialogHeader class="space-y-1">
          <UiDialogTitle class="text-xl">Invite Team Member</UiDialogTitle>
          <UiDialogDescription>
            Invite someone to collaborate in
            <span class="font-medium text-foreground">{{ activeOrg?.data?.name || "your workplace" }}</span>
          </UiDialogDescription>
        </UiDialogHeader>
      </div>

      <form class="space-y-5 py-4" @submit="handleInvite">
        <UiFormBuilder :fields="formFields" />
      </form>

      <UiDialogFooter class="gap-3">
        <UiButton variant="outline" :disabled="isInviting" @click="handleClose"> Cancel </UiButton>
        <UiButton :disabled="isInviting || !values.email" @click="handleInvite">
          <Icon v-if="isInviting" name="svg-spinners:ring-resize" class="size-4" />
          <Icon v-else name="lucide:send" class="size-4" />
          Send Invitation
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
