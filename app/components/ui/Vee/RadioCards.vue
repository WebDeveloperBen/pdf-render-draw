<script setup lang="ts">
import { useField } from "vee-validate"

export interface RadioCardOption {
  value: string
  label: string
  description?: string
  icon?: string
}

export interface RadioCardsProps {
  name: string
  label?: string
  description?: string
  options: RadioCardOption[]
  disabled?: boolean
  modelValue?: string
  rules?: any
  validateOnMount?: boolean
}

const props = defineProps<RadioCardsProps>()

const { value, setValue, errorMessage } = useField<string>(() => props.name, props.rules, {
  initialValue: props.modelValue,
  label: props.label,
  validateOnMount: props.validateOnMount,
  type: "radio",
  syncVModel: true
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="label || description" class="space-y-1">
      <UiLabel v-if="label">{{ label }}</UiLabel>
      <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
    </div>

    <div class="grid gap-3">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :disabled="disabled"
        :class="[
          'group flex items-start gap-4 rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
          value === option.value
            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
            : 'border-border hover:border-primary/50'
        ]"
        @click="setValue(option.value)"
      >
        <div
          v-if="option.icon"
          :class="[
            'flex size-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ease-out',
            value === option.value
              ? 'bg-primary text-primary-foreground scale-110'
              : 'bg-muted group-hover:bg-muted/80'
          ]"
        >
          <Icon :name="option.icon" class="size-5" />
        </div>
        <div class="flex-1 space-y-1">
          <p class="font-medium leading-none">{{ option.label }}</p>
          <p v-if="option.description" class="text-sm text-muted-foreground">
            {{ option.description }}
          </p>
        </div>
        <div
          :class="[
            'ml-auto shrink-0 transition-all duration-200',
            value === option.value ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          ]"
        >
          <Icon name="lucide:check-circle-2" class="size-5 text-primary" />
        </div>
      </button>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
  </div>
</template>
