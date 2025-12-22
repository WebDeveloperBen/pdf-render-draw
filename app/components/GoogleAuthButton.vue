<script lang="ts" setup>
import { toast } from "vue-sonner"

const props = withDefaults(
  defineProps<{
    mode?: "signin" | "signup"
    disabled?: boolean
  }>(),
  {
    mode: "signin",
    disabled: false
  }
)

const label = computed(() => (props.mode === "signup" ? "Sign up with Google" : "Continue with Google"))

const handleClick = () => {
  toast.info("Google authentication coming soon")
  // TODO: Implement Google OAuth
  // authClient.signIn.social({ provider: "google" })
}
</script>

<template>
  <UiButton variant="outline" type="button" class="w-full" :disabled="disabled" @click="handleClick">
    <IconsGoogle class="size-5" />
    <span class="ml-2">{{ label }}</span>
  </UiButton>
</template>
