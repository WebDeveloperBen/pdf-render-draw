<script lang="ts" setup>
import type { Component } from "vue"
import { Plus, RefreshCcw, File, Calendar, User } from "lucide-vue-next"

withDefaults(
  defineProps<{
    title?: string
    description?: string
    buttonText1?: string
    buttonText2?: string
    buttonIcon1?: Component
    buttonIcon2?: Component
    icon1?: Component
    icon2?: Component
    icon3?: Component
  }>(),
  {
    title: "No data found",
    description: "It looks like there's no data in this page. You can create a new one or refresh the page.",
    buttonText1: "Create new",
    buttonText2: "Refresh",
    buttonIcon1: () => Plus,
    buttonIcon2: () => RefreshCcw,
    icon1: () => File,
    icon2: () => Calendar,
    icon3: () => User
  }
)
</script>
<template>
  <div class="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
    <div class="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <div class="flex items-center gap-3">
        <div class="-rotate-8 rounded-md border p-3 shadow">
          <component :is="icon1" class="size-5 text-muted-foreground" />
        </div>
        <div class="-translate-y-2 rounded-md border p-3 shadow">
          <component :is="icon2" class="size-5 text-muted-foreground" />
        </div>
        <div class="rotate-8 rounded-md border p-3 shadow">
          <component :is="icon3" class="size-5 text-muted-foreground" />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <slot name="title">
          <h1 v-if="title" class="text-lg font-bold">
            {{ title }}
          </h1>
        </slot>
        <slot name="description">
          <p v-if="description" class="text-sm text-muted-foreground">
            {{ description }}
          </p>
        </slot>
      </div>
      <div class="flex items-center gap-2">
        <slot name="button1">
          <UiButton>
            <slot name="buttonIcon1">
              <component :is="buttonIcon1" class="size-4" />
            </slot>
            <slot name="buttonText1">
              <span v-if="buttonText1">
                {{ buttonText1 }}
              </span>
            </slot>
          </UiButton>
        </slot>
        <slot name="button2">
          <UiButton variant="outline">
            <slot name="buttonIcon2">
              <component :is="buttonIcon2" class="size-4" />
            </slot>
            <slot name="buttonText2">
              <span v-if="buttonText2">
                {{ buttonText2 }}
              </span>
            </slot>
          </UiButton>
        </slot>
      </div>
    </div>
  </div>
</template>
