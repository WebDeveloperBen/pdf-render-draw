<script setup lang="ts">
import { CheckCircle } from "lucide-vue-next"

definePageMeta({ layout: "default" })
useSeoMeta({ title: "Payment Successful" })

const { refetch, planName } = useSubscription()

// Refetch profile to pick up the new subscription
// (webhook may take a moment — poll briefly)
const isLoading = ref(true)

onMounted(async () => {
  // Give the webhook a moment to process
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await refetch()
  isLoading.value = false
})
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6 py-16 text-center">
    <div class="flex justify-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle class="size-8 text-primary" />
      </div>
    </div>

    <div class="space-y-2">
      <h1 class="text-3xl font-bold">Welcome to {{ planName }}!</h1>
      <p class="text-muted-foreground">
        Your subscription is now active. You have full access to all features included in your plan.
      </p>
    </div>

    <div class="flex justify-center gap-3 pt-4">
      <UiButton to="/projects" variant="default">Go to Projects</UiButton>
      <UiButton to="/organisation/billing" variant="outline">View Billing</UiButton>
    </div>
  </div>
</template>
