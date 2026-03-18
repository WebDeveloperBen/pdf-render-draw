<script setup lang="ts">
import { User, X } from "lucide-vue-next"

const props = defineProps<{
  modelValue: string[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string[]]
}>()

const inputValue = ref("")
const inputRef = ref<HTMLInputElement | null>(null)
const error = ref("")

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateEmail = (email: string): boolean => {
  return emailRegex.test(email.trim())
}

const addEmail = (email: string) => {
  const trimmedEmail = email.trim().toLowerCase()

  if (!trimmedEmail) return

  if (!validateEmail(trimmedEmail)) {
    error.value = "Please enter a valid email address"
    return
  }

  if (props.modelValue.includes(trimmedEmail)) {
    error.value = "This email has already been added"
    return
  }

  error.value = ""
  emit("update:modelValue", [...props.modelValue, trimmedEmail])
  inputValue.value = ""
}

const removeEmail = (email: string) => {
  emit(
    "update:modelValue",
    props.modelValue.filter((e) => e !== email)
  )
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
    event.preventDefault()
    addEmail(inputValue.value)
  } else if (event.key === "Backspace" && !inputValue.value && props.modelValue.length > 0) {
    // Remove last email on backspace if input is empty
    removeEmail(props.modelValue[props.modelValue.length - 1]!)
  }
}

const handleBlur = () => {
  if (inputValue.value.trim()) {
    addEmail(inputValue.value)
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedText = event.clipboardData?.getData("text") || ""

  // Split by common separators (comma, semicolon, newline, space)
  const emails = pastedText.split(/[,;\s\n]+/).filter(Boolean)

  const validEmails: string[] = []
  const invalidEmails: string[] = []

  emails.forEach((email) => {
    const trimmed = email.trim().toLowerCase()
    if (validateEmail(trimmed) && !props.modelValue.includes(trimmed) && !validEmails.includes(trimmed)) {
      validEmails.push(trimmed)
    } else if (trimmed && !validateEmail(trimmed)) {
      invalidEmails.push(trimmed)
    }
  })

  if (validEmails.length > 0) {
    emit("update:modelValue", [...props.modelValue, ...validEmails])
  }

  if (invalidEmails.length > 0) {
    error.value = `Invalid emails: ${invalidEmails.slice(0, 3).join(", ")}${invalidEmails.length > 3 ? "..." : ""}`
  }
}

const focusInput = () => {
  inputRef.value?.focus()
}
</script>

<template>
  <div class="space-y-2">
    <div
      class="flex min-h-10 w-full flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      :class="[
        disabled && 'cursor-not-allowed opacity-50',
        error && 'border-destructive focus-within:ring-destructive'
      ]"
      @click="focusInput"
    >
      <!-- Email tags -->
      <TransitionGroup name="tag">
        <div
          v-for="email in modelValue"
          :key="email"
          class="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm"
        >
          <User class="size-3 text-muted-foreground" />
          <span class="max-w-[200px] truncate">{{ email }}</span>
          <button
            type="button"
            class="ml-0.5 rounded-sm hover:bg-secondary-foreground/20 focus:outline-none"
            :disabled="disabled"
            @click.stop="removeEmail(email)"
          >
            <X class="size-3" />
          </button>
        </div>
      </TransitionGroup>

      <!-- Input -->
      <input
        ref="inputRef"
        v-model="inputValue"
        type="email"
        class="flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        :class="modelValue.length > 0 ? 'min-w-[150px]' : 'w-full'"
        :placeholder="modelValue.length === 0 ? placeholder || 'Enter email addresses...' : 'Add another...'"
        :disabled="disabled"
        @keydown="handleKeydown"
        @blur="handleBlur"
        @paste="handlePaste"
      />
    </div>

    <!-- Error message -->
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <!-- Help text -->
    <p v-else class="text-xs text-muted-foreground">
      Press Enter, Tab, or comma to add. Paste multiple emails separated by commas.
    </p>
  </div>
</template>

<style scoped>
.tag-enter-active,
.tag-leave-active {
  transition: all 0.2s ease;
}

.tag-enter-from,
.tag-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
