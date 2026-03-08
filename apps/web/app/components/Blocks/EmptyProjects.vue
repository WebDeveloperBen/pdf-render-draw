<script lang="ts" setup>
withDefaults(
  defineProps<{
    title?: string
    description?: string
    buttonText1?: string
    buttonText2?: string
    buttonIcon1?: string
    buttonIcon2?: string
    icon1?: string
    icon2?: string
    icon3?: string
  }>(),
  {
    title: "No data found",
    description: "It looks like there's no data in this page. You can create a new one or refresh the page.",
    buttonText1: "Create new",
    buttonText2: "Refresh",
    buttonIcon1: "lucide:plus",
    buttonIcon2: "lucide:refresh-ccw",
    icon1: "lucide:file",
    icon2: "lucide:calendar",
    icon3: "lucide:user"
  }
)
</script>
<template>
  <div class="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
    <div class="flex w-full max-w-md flex-col items-center gap-6 text-center">
      <div class="flex items-center gap-3">
        <div class="-rotate-8 rounded-md border p-3 shadow">
          <Icon :name="icon1" class="size-5 text-muted-foreground" />
        </div>
        <div class="-translate-y-2 rounded-md border p-3 shadow">
          <Icon :name="icon2" class="size-5 text-muted-foreground" />
        </div>
        <div class="rotate-8 rounded-md border p-3 shadow">
          <Icon :name="icon3" class="size-5 text-muted-foreground" />
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
              <Icon :name="buttonIcon1" class="size-4" />
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
              <Icon :name="buttonIcon2" class="size-4" />
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
