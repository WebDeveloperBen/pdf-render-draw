<script lang="ts" setup>
import { Github, Loader2 } from "lucide-vue-next"
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

const config = useRuntimeConfig()
const providers = computed(() => config.public.authProviders as { google: boolean; github: boolean })
const hasAnyProvider = computed(() => providers.value.google || providers.value.github)

const isLoading = ref<string | null>(null)

async function signInWith(provider: "google" | "github") {
  isLoading.value = provider
  try {
    await authClient.signIn.social({
      provider,
      callbackURL: "/"
    })
  } catch (e: any) {
    toast.error(e.message || `Failed to sign in with ${provider}`)
    isLoading.value = null
  }
}
</script>

<template>
  <div v-if="hasAnyProvider" class="grid gap-3">
    <!-- Google -->
    <UiButton
      v-if="providers.google"
      variant="outline"
      type="button"
      class="w-full"
      :disabled="disabled || !!isLoading"
      @click="signInWith('google')"
    >
      <Loader2 v-if="isLoading === 'google'" class="mr-2 size-4 animate-spin" />
      <IconsGoogle v-else class="mr-2 size-5" />
      {{ mode === "signup" ? "Sign up with Google" : "Continue with Google" }}
    </UiButton>

    <!-- GitHub -->
    <UiButton
      v-if="providers.github"
      variant="outline"
      type="button"
      class="w-full"
      :disabled="disabled || !!isLoading"
      @click="signInWith('github')"
    >
      <Loader2 v-if="isLoading === 'github'" class="mr-2 size-4 animate-spin" />
      <Github v-else class="mr-2 size-5" />
      {{ mode === "signup" ? "Sign up with GitHub" : "Continue with GitHub" }}
    </UiButton>
  </div>

  <!-- No providers configured — show coming soon -->
  <UiTooltip v-else>
    <UiTooltipTrigger as-child>
      <span class="inline-block w-full">
        <UiButton variant="outline" type="button" class="pointer-events-none w-full" disabled>
          <IconsGoogle class="size-5" />
          <span class="ml-2">{{ mode === "signup" ? "Sign up with Google" : "Continue with Google" }}</span>
        </UiButton>
      </span>
    </UiTooltipTrigger>
    <UiTooltipContent>
      <p>Coming soon</p>
    </UiTooltipContent>
  </UiTooltip>
</template>
