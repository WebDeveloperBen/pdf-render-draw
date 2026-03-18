<script setup lang="ts">
import { Mail } from "lucide-vue-next"
</script>

<template>
  <div class="flex flex-col items-center justify-between gap-4 rounded-2xl border bg-card p-6 sm:flex-row">
    <div class="flex items-center gap-4">
      <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Mail class="size-6 text-primary" />
      </div>
      <div>
        <p class="font-semibold">Still need help?</p>
        <p class="text-sm text-muted-foreground">
          Reach out to our support team and we'll get back to you within 24 hours.
        </p>
      </div>
    </div>
    <UiButton as="a" href="mailto:hi@metremate.com.au" class="shrink-0">
      <Mail class="mr-2 size-4" />
      Contact Support
    </UiButton>
  </div>
</template>
