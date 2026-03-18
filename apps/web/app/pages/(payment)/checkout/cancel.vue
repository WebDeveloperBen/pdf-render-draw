<script setup lang="ts">
import { XCircle } from "lucide-vue-next"

definePageMeta({ layout: "default" })
useSeoMeta({ title: "Checkout Cancelled" })
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6 py-16 text-center">
    <div class="flex justify-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-muted">
        <XCircle class="size-8 text-muted-foreground" />
      </div>
    </div>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold">Checkout cancelled</h1>
      <p class="text-muted-foreground">
        No worries — you haven't been charged. You can upgrade anytime from the pricing page.
      </p>
    </div>

    <div class="flex justify-center gap-3 pt-4">
      <UiButton to="/pricing" variant="default">View Plans</UiButton>
      <UiButton to="/" variant="outline">Back to Dashboard</UiButton>
    </div>
  </div>
</template>
