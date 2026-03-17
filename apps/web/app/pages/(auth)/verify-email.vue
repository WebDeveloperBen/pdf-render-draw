<script lang="ts" setup>
import { toast } from "vue-sonner"

definePageMeta({ layout: false })

useSeoMeta({
  title: "Verify your email",
  description: "Confirming your email address."
})

const route = useRoute()
const router = useRouter()

// After Better Auth verifies the email, it redirects here.
// If the user lands here directly (e.g. expired/invalid token), show appropriate state.
const status = computed(() => {
  if (route.query.error) return "error" as const
  return "success" as const
})

const errorMessage = computed(() => {
  const error = route.query.error as string | undefined
  if (error === "INVALID_TOKEN") return "This verification link is invalid or has expired."
  if (error) return error
  return "Verification failed. Please try again."
})

const resendEmail = computed(() => route.query.email as string | undefined)
const isResending = ref(false)

async function handleResend() {
  if (!resendEmail.value) {
    toast.error("No email address available. Please sign up again.")
    return
  }

  isResending.value = true
  try {
    await authClient.sendVerificationEmail({
      email: resendEmail.value,
      callbackURL: "/verify-email"
    })
    toast.success("Verification email sent! Check your inbox.")
  } catch (e: any) {
    toast.error(e.message || "Failed to resend verification email.")
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <div class="flex items-center justify-center px-5">
      <div class="w-full max-w-100">
        <!-- Success -->
        <div v-if="status === 'success'" class="flex flex-col items-center text-center">
          <div class="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg border bg-background">
            <Icon name="lucide:check-circle-2" class="size-6 text-emerald-500" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Email verified!</h1>
          <p class="mt-1 text-muted-foreground">Your email has been confirmed. You can now sign in.</p>
          <UiButton class="mt-8 w-full" @click="router.push('/login')">
            <Icon name="lucide:log-in" class="mr-2 size-4" />
            Continue to Login
          </UiButton>
        </div>

        <!-- Error -->
        <div v-else class="flex flex-col items-center text-center">
          <div class="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg border bg-background">
            <Icon name="lucide:x-circle" class="size-6 text-destructive" />
          </div>
          <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">Verification failed</h1>
          <p class="mt-2 text-muted-foreground">{{ errorMessage }}</p>

          <div class="mt-8 flex w-full flex-col gap-3">
            <UiButton
              v-if="resendEmail"
              class="w-full"
              :disabled="isResending"
              @click="handleResend"
            >
              <Icon v-if="isResending" name="svg-spinners:270-ring-with-bg" class="mr-2 size-4" />
              <Icon v-else name="lucide:mail" class="mr-2 size-4" />
              Resend verification email
            </UiButton>
            <UiButton variant="outline" class="w-full" @click="router.push('/login')">
              Back to Login
            </UiButton>
          </div>
        </div>
      </div>
    </div>
    <div class="hidden bg-muted lg:block">
      <div class="flex h-full flex-col items-center justify-center p-8">
        <div class="max-w-md text-center">
          <Icon name="lucide:mail-check" class="mx-auto mb-6 size-16 text-primary" />
          <h2 class="mb-4 text-2xl font-bold">Email Verification</h2>
          <p class="text-muted-foreground">
            Verifying your email helps keep your account secure and ensures you can recover your password if needed.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
