<script lang="ts" setup>
import { toast } from "vue-sonner"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"

definePageMeta({ layout: false })

useSeoMeta({
  title: "Forgot your password?",
  description: "No worries, we'll send you reset instructions."
})

const showSuccess = ref(false)

const schema = toTypedSchema(
  z.object({
    email: z.email("Please enter a valid email")
  })
)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    email: ""
  }
})

const submit = handleSubmit(async (values) => {
  try {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset"
    })

    if (error) {
      toast.error(error.message || "Failed to send reset instructions")
      return
    }

    showSuccess.value = true
  } catch (error: any) {
    toast.error(error.message || "Failed to send reset instructions")
  }
})
</script>

<template>
  <div v-if="showSuccess">
    <AuthSuccessSend />
  </div>
  <div v-else class="grid min-h-screen lg:grid-cols-2">
    <div class="flex items-center justify-center px-5">
      <div class="w-full max-w-100">
        <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Forgot your password?</h1>
        <p class="mt-1 text-muted-foreground">No worries, we'll send you reset instructions.</p>

        <ClientOnly>
          <form class="mt-8" @submit="submit">
            <fieldset :disabled="isSubmitting" class="grid gap-5">
              <UiVeeInput label="Email address" type="email" name="email" placeholder="you@example.com" />
              <UiButton class="w-full" type="submit">
                <Icon v-if="isSubmitting" name="svg-spinners:270-ring-with-bg" class="mr-2 size-4" />
                <Icon v-else name="lucide:send" class="mr-2 size-4" />
                Send Reset Instructions
              </UiButton>
            </fieldset>
          </form>

          <template #fallback>
            <div class="mt-8 grid gap-5">
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-24" />
                <UiSkeleton class="h-10 w-full" />
              </div>
              <UiSkeleton class="h-10 w-full" />
            </div>
          </template>
        </ClientOnly>

        <p class="mt-6 text-center text-sm text-muted-foreground">
          Remember your password?
          <NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline" to="/login">
            Sign in
          </NuxtLink>
        </p>
      </div>
    </div>
    <div class="hidden bg-muted lg:block">
      <div class="flex h-full flex-col items-center justify-center p-8">
        <div class="max-w-md text-center">
          <Icon name="lucide:key-round" class="mx-auto mb-6 size-16 text-primary" />
          <h2 class="mb-4 text-2xl font-bold">Secure Password Recovery</h2>
          <p class="text-muted-foreground">
            We'll send you a secure link to reset your password. The link will expire in 24 hours for your security.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
