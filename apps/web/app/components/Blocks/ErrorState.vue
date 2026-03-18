<script lang="ts" setup>
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-vue-next"
import type { Component } from "vue"

withDefaults(
  defineProps<{
    /** Main heading */
    title?: string
    /** Error detail message */
    description?: string
    /** Icon component to display */
    icon?: Component
    /** Label for the back/navigate-away button */
    backLabel?: string
    /** Route for the back button */
    backTo?: string
    /** Label for the retry button */
    retryLabel?: string
    /** Show the retry button */
    showRetry?: boolean
    /** Show the back button */
    showBack?: boolean
  }>(),
  {
    title: "Something went wrong",
    description: undefined,
    icon: () => AlertCircle,
    backLabel: "Go back",
    backTo: "/",
    retryLabel: "Retry",
    showRetry: true,
    showBack: true
  }
)

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex h-full items-center justify-center">
    <div class="flex max-w-md flex-col items-center gap-4 text-center">
      <slot name="icon">
        <div class="flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <component :is="icon" class="size-7 text-destructive" />
        </div>
      </slot>

      <div>
        <h2 class="text-lg font-semibold">{{ title }}</h2>
        <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
      </div>

      <slot>
        <div class="flex gap-3">
          <UiButton v-if="showBack" variant="outline" :to="backTo">
            <ArrowLeft class="mr-2 size-4" />
            {{ backLabel }}
          </UiButton>
          <UiButton v-if="showRetry" @click="emit('retry')">
            <RotateCcw class="mr-2 size-4" />
            {{ retryLabel }}
          </UiButton>
        </div>
      </slot>
    </div>
  </div>
</template>
