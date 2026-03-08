<script lang="ts" setup>
withDefaults(
  defineProps<{
    mode?: "signin" | "signup"
  }>(),
  {
    mode: "signin"
  }
)
</script>

<template>
  <UiTooltip>
    <UiTooltipTrigger as-child>
      <!-- Wrapper span needed because disabled buttons don't receive pointer events -->
      <span class="inline-block w-full">
        <UiButton variant="outline" type="button" class="w-full pointer-events-none" disabled>
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
