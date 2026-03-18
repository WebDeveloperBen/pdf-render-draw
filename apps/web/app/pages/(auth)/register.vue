<script lang="ts" setup>
import { PencilRuler } from "lucide-vue-next"
import { toast } from "vue-sonner"
import { toTypedSchema } from "@vee-validate/zod"
import { z } from "zod"

definePageMeta({ layout: false })

useSeoMeta({
  title: "Get started for free",
  description: "No credit card required. Start measuring immediately."
})

const { redirectAfterAuth } = useAuth()

const schema = toTypedSchema(
  z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.email("Please enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    terms: z.literal(true, { errorMap: () => ({ message: "You must accept the terms and conditions" }) })
  })
)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: schema,
  initialValues: {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    terms: false as boolean
  }
})

const submit = handleSubmit(async (values) => {
  try {
    const result = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: `${values.firstName} ${values.lastName}`,
      firstName: values.firstName,
      lastName: values.lastName
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to create account")
      return
    }

    toast.success("Account created successfully!")
    await redirectAfterAuth()
  } catch (error: any) {
    toast.error(error.message || "Failed to create account")
  }
})
</script>
<template>
  <div class="grid h-screen lg:grid-cols-2">
    <div class="flex items-center justify-center px-5">
      <div class="w-full max-w-100">
        <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Get started for free</h1>
        <p class="mt-1 text-muted-foreground">No credit card required. Start building immediately.</p>

        <ClientOnly>
          <form class="mt-8" @submit="submit">
            <fieldset :disabled="isSubmitting" class="grid gap-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <UiVeeInput label="First name" name="firstName" placeholder="John" />
                <UiVeeInput label="Last name" name="lastName" placeholder="Doe" />
              </div>
              <UiVeeInput label="Email" type="email" name="email" placeholder="you@example.com" />
              <UiVeeInput label="Password" type="password" name="password" placeholder="••••••••" />
              <UiVeeCheckbox name="terms">
                <template #label>
                  <span class="text-sm">
                    I agree to the
                    <NuxtLink to="/terms" target="_blank" class="text-primary underline-offset-2 hover:underline">Terms of Service</NuxtLink>
                    and
                    <NuxtLink to="/privacy" target="_blank" class="text-primary underline-offset-2 hover:underline">Privacy Policy</NuxtLink>
                  </span>
                </template>
              </UiVeeCheckbox>
              <UiButton class="w-full" type="submit">
                <UiSpinner v-if="isSubmitting" class="mr-2 size-4" />
                Create account
              </UiButton>
            </fieldset>
          </form>

          <div>
            <UiDivider class="my-6" label="OR" />
            <GoogleAuthButton mode="signup" :disabled="isSubmitting" />
          </div>

          <template #fallback>
            <div class="mt-8 grid gap-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <UiSkeleton class="h-4 w-20" />
                  <UiSkeleton class="h-10 w-full" />
                </div>
                <div class="space-y-2">
                  <UiSkeleton class="h-4 w-20" />
                  <UiSkeleton class="h-10 w-full" />
                </div>
              </div>
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-12" />
                <UiSkeleton class="h-10 w-full" />
              </div>
              <div class="space-y-2">
                <UiSkeleton class="h-4 w-16" />
                <UiSkeleton class="h-10 w-full" />
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
          Already have an account?
          <NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline" to="/login">
            Sign in
          </NuxtLink>
        </p>
      </div>
    </div>
    <div class="hidden bg-muted lg:block">
      <div class="flex h-full flex-col items-center justify-center p-8">
        <div class="max-w-md text-center">
          <PencilRuler class="mx-auto mb-6 size-16 text-primary" />
          <h2 class="mb-4 text-2xl font-bold">Annotate PDFs with Ease</h2>
          <p class="text-muted-foreground">
            Draw, measure, and annotate building plans directly on your PDFs. Perfect for tradespeople.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
