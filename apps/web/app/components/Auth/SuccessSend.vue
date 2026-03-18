<script lang="ts" setup>
import { Mail, ArrowLeft, Loader2 } from "lucide-vue-next"
import { toast } from "vue-sonner"

const props = withDefaults(
  defineProps<{
    email?: string
    type?: "password-reset" | "verification"
  }>(),
  {
    email: undefined,
    type: "password-reset"
  }
)

const title = "Check your inbox"
const description = computed(() =>
  props.type === "verification"
    ? "We've sent you an email to verify your address."
    : "We've sent you an email with instructions to reset your password."
)

useSeoMeta({ title, description })

const isResending = ref(false)

async function handleResend() {
  if (!props.email) {
    toast.error("No email address available.")
    return
  }

  isResending.value = true
  try {
    if (props.type === "verification") {
      await authClient.sendVerificationEmail({ email: props.email })
    } else {
      await authClient.requestPasswordReset({
        email: props.email,
        redirectTo: "/reset"
      })
    }
    toast.success("Email sent! Check your inbox.")
  } catch (e: any) {
    toast.error(e.message || "Failed to resend email.")
  } finally {
    isResending.value = false
  }
}
</script>
<template>
  <div class="relative flex h-screen items-center justify-center">
    <div
      class="absolute inset-0 z-1 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] mask-[radial-gradient(circle_at_center,white,transparent_90%)] bg-size-[100px_100px]"
    />
    <div class="relative z-2 w-full max-w-[340px] px-5">
      <div class="mx-auto mb-6 flex size-14 items-center justify-center rounded-lg border bg-background">
        <Mail class="size-6" />
      </div>

      <div class="flex flex-col items-center text-center">
        <h1 class="text-2xl font-bold tracking-tight lg:text-3xl">{{ title }}</h1>
        <p class="mt-1 text-muted-foreground">{{ description }}</p>
        <p v-if="email" class="mt-2 text-sm text-muted-foreground">
          Sent to <span class="font-medium text-foreground">{{ email }}</span>
        </p>
      </div>

      <div class="mt-10">
        <UiButton class="w-full" :disabled="isResending || !email" @click="handleResend">
          <Loader2 v-if="isResending" class="mr-2 size-4 animate-spin" />
          <ArrowLeft v-else class="size-5" />
          <span>Resend instructions</span>
        </UiButton>
      </div>
      <p class="mt-8 text-center text-sm">
        <NuxtLink class="font-semibold text-primary underline-offset-2 hover:underline" to="/login">
          Back to Log in
        </NuxtLink>
      </p>
    </div>
  </div>
</template>
