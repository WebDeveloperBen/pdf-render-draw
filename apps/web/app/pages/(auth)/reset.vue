<script lang="ts" setup>
import { ShieldCheck } from "lucide-vue-next"
import { toast } from "vue-sonner"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"

definePageMeta({ layout: false })

useSeoMeta({
  title: "Reset your password",
  description: "Enter your new password below."
})

const route = useRoute()
const router = useRouter()

// Token from the reset email link
const token = computed(() => route.query.token as string | undefined)

const schema = toTypedSchema(
  z
    .object({
      password: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string().min(1, "Please confirm your password")
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"]
    })
)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    password: "",
    confirmPassword: ""
  }
})

const submit = handleSubmit(async (values) => {
  if (!token.value) {
    toast.error("Invalid or missing reset token")
    return
  }

  try {
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token: token.value
    })

    if (error) {
      toast.error(error.message || "Failed to reset password")
      return
    }

    toast.success("Password reset successfully!")
    await router.push("/login")
  } catch (error: any) {
    toast.error(error.message || "Failed to reset password")
  }
})
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <div class="flex items-center justify-center px-5">
      <div class="w-full max-w-100">
        <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Reset your password</h1>
        <p class="mt-1 text-muted-foreground">Enter your new password below.</p>

        <ClientOnly>
          <div v-if="!token" class="mt-8">
            <UiAlert
              variant="destructive"
              icon="lucide:alert-circle"
              title="Invalid Link"
              description="This password reset link is invalid or has expired."
            />
            <NuxtLink class="mt-4 inline-block font-medium text-primary underline" to="/forgot">
              Request a new one
            </NuxtLink>
          </div>

          <form v-else class="mt-8" @submit="submit">
            <fieldset :disabled="isSubmitting" class="grid gap-5">
              <UiVeeInput label="New password" type="password" name="password" placeholder="••••••••" />
              <UiVeeInput label="Confirm password" type="password" name="confirmPassword" placeholder="••••••••" />
              <UiButton class="w-full" type="submit">
                <UiSpinner v-if="isSubmitting" class="mr-2 size-4" />
                Reset Password
              </UiButton>
            </fieldset>
          </form>

          <template #fallback>
            <div class="mt-8 grid gap-5">
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-24" />
                <UiSkeleton class="h-10 w-full" />
              </div>
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-32" />
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
          <ShieldCheck class="mx-auto mb-6 size-16 text-primary" />
          <h2 class="mb-4 text-2xl font-bold">Almost There!</h2>
          <p class="text-muted-foreground">
            Choose a strong password to keep your account secure. Use a mix of letters, numbers, and symbols.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
