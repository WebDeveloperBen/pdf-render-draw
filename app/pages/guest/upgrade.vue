<script setup lang="ts">
import { toast } from "vue-sonner"
import { useForm } from "vee-validate"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"
import type { FormBuilder } from "@/components/ui/FormBuilder/FormBuilder.vue"
import { usePostApiGuestUpgrade } from "@/models/api"

definePageMeta({
  layout: "guest",
  middleware: ["guest"]
})

// Form schema
const upgradeSchema = toTypedSchema(
  z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required")
  })
)

// Form state
const form = useForm({
  validationSchema: upgradeSchema,
  initialValues: {
    firstName: "",
    lastName: ""
  }
})

// Use generated API mutation hook
const { mutateAsync: upgradeAccount, isPending: isUpgrading } = usePostApiGuestUpgrade()

// FormBuilder fields
const formFields: FormBuilder[] = [
  {
    variant: "Input",
    name: "firstName",
    label: "First name",
    placeholder: "John",
    required: true,
    wrapperClass: "space-y-2"
  },
  {
    variant: "Input",
    name: "lastName",
    label: "Last name",
    placeholder: "Doe",
    required: true,
    wrapperClass: "space-y-2"
  }
]

// Handle form submission
const handleUpgrade = form.handleSubmit(async (values) => {
  try {
    await upgradeAccount({
      data: {
        firstName: values.firstName,
        lastName: values.lastName
      }
    })

    toast.success("Account upgraded! Welcome aboard.")

    // Redirect to main dashboard - page reload will refresh session
    window.location.href = "/"
  } catch (e: any) {
    toast.error(e.data?.statusMessage || "Failed to upgrade account")
  }
})

useSeoMeta({
  title: "Upgrade Your Account"
})
</script>

<template>
  <div class="flex items-center justify-center py-12">
    <UiCard class="w-full max-w-md">
      <UiCardHeader class="text-center">
        <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Icon name="lucide:rocket" class="size-8 text-primary" />
        </div>
        <UiCardTitle class="text-2xl">Upgrade to Free Account</UiCardTitle>
        <UiCardDescription>Get your own workspace to create and manage projects</UiCardDescription>
      </UiCardHeader>

      <UiCardContent>
        <form class="space-y-4" @submit="handleUpgrade">
          <div class="grid gap-4 sm:grid-cols-2">
            <UiFormBuilder :fields="formFields" />
          </div>

          <div class="rounded-lg border bg-muted/50 p-4 space-y-2">
            <p class="font-medium text-sm">What you'll get:</p>
            <ul class="text-sm text-muted-foreground space-y-1">
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Your own workspace
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Create unlimited projects
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Share with your team
              </li>
              <li class="flex items-center gap-2">
                <Icon name="lucide:check" class="size-4 text-green-500" />
                Full annotation tools
              </li>
            </ul>
          </div>

          <UiButton type="submit" class="w-full" :disabled="isUpgrading">
            <Icon v-if="isUpgrading" name="svg-spinners:ring-resize" class="size-4" />
            <Icon v-else name="lucide:rocket" class="size-4" />
            Create My Free Account
          </UiButton>
        </form>
      </UiCardContent>

      <UiCardFooter class="justify-center">
        <NuxtLink to="/guest" class="text-sm text-muted-foreground hover:text-foreground">Maybe later</NuxtLink>
      </UiCardFooter>
    </UiCard>
  </div>
</template>
