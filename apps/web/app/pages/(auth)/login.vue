<script lang="ts" setup>
import { LockKeyhole } from "lucide-vue-next"
import { toast } from "vue-sonner"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"

definePageMeta({ layout: false })

useSeoMeta({
  title: "Welcome back - Log in",
  description: "Log in to your account to continue."
})

const { redirectAfterAuth } = useAuth()

const schema = toTypedSchema(
  z.object({
    email: z.email("Please enter a valid email"),
    password: z.string().min(1, "Password is required"),
    remember: z.boolean().optional()
  })
)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    email: "",
    password: "",
    remember: false
  }
})

const submit = handleSubmit(async (values) => {
  try {
    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to sign in")
      return
    }

    toast.success("Signed in successfully")
    await redirectAfterAuth()
  } catch (error: any) {
    toast.error(error.message || "Failed to sign in")
  }
})
</script>
<template>
  <div class="grid h-screen lg:grid-cols-2">
    <div class="flex items-center justify-center px-5">
      <div class="w-full max-w-100">
        <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Welcome back</h1>
        <p class="mt-1 text-muted-foreground">Log in to your account to continue.</p>

        <ClientOnly>
          <form class="mt-8" @submit="submit">
            <fieldset :disabled="isSubmitting" class="grid gap-5">
              <UiVeeInput label="Email" type="email" name="email" placeholder="you@example.com" />
              <UiVeeInput label="Password" type="password" name="password" placeholder="••••••••" />
              <div class="flex items-center justify-between">
                <UiVeeCheckbox label="Remember me" name="remember" />
                <NuxtLink class="text-sm font-medium text-primary underline-offset-2 hover:underline" to="/forgot">
                  Forgot password?
                </NuxtLink>
              </div>
              <UiButton class="w-full" type="submit">
                <UiSpinner v-if="isSubmitting" class="mr-2 size-4" />
                Log in
              </UiButton>
            </fieldset>
          </form>

          <div>
            <UiDivider class="my-6" label="OR" />
            <GoogleAuthButton mode="signin" :disabled="isSubmitting" />
          </div>

          <template #fallback>
            <div class="mt-8 grid gap-5">
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-12" />
                <UiSkeleton class="h-10 w-full" />
              </div>
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-16" />
                <UiSkeleton class="h-10 w-full" />
              </div>
              <div class="flex items-center justify-between">
                <UiSkeleton class="h-5 w-28" />
                <UiSkeleton class="h-4 w-24" />
              </div>
              <UiSkeleton class="h-10 w-full" />
            </div>
            <div class="my-6 flex items-center gap-3">
              <UiSkeleton class="h-px flex-1" />
              <UiSkeleton class="h-4 w-8" />
              <UiSkeleton class="h-px flex-1" />
            </div>
            <UiSkeleton class="h-10 w-full" />
          </template>
        </ClientOnly>

        <p class="mt-6 text-sm text-muted-foreground">
          Don't have an account?
          <NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline" to="/register">
            Create account
          </NuxtLink>
        </p>
      </div>
    </div>
    <div class="hidden bg-muted lg:block">
      <div class="flex h-full flex-col items-center justify-center p-8">
        <div class="max-w-md text-center">
          <LockKeyhole class="mx-auto mb-6 size-16 text-primary" />
          <h2 class="mb-4 text-2xl font-bold">Secure & Private</h2>
          <p class="text-muted-foreground">
            Your data is encrypted and secure. We never share your information with third parties.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
