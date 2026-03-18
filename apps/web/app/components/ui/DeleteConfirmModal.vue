<script setup lang="ts">
import { Trash2, TriangleAlert } from "lucide-vue-next"

interface Props {
  /** Title of the modal */
  title?: string
  /** Description text explaining what will happen */
  description?: string
  /** Name of the item being deleted (shown prominently) */
  itemName: string
  /** Whether the delete operation is in progress */
  isDeleting?: boolean
  /** Require typing the item name to confirm (for dangerous deletes) */
  requireConfirmation?: boolean
  /** Custom confirm button text */
  confirmText?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: "Delete Item",
  description: "This action cannot be undone.",
  isDeleting: false,
  requireConfirmation: false,
  confirmText: "Delete"
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const isOpen = defineModel<boolean>("open", { required: true })

// Confirmation input for dangerous deletes
const confirmationInput = ref("")

const canConfirm = computed(() => {
  if (!props.requireConfirmation) return true
  return confirmationInput.value === props.itemName
})

function handleConfirm() {
  if (!canConfirm.value || props.isDeleting) return
  emit("confirm")
}

function handleCancel() {
  emit("cancel")
  isOpen.value = false
}

// Reset confirmation input when modal closes
watch(isOpen, (open) => {
  if (!open) {
    confirmationInput.value = ""
  }
})
</script>

<template>
  <UiDialog v-model:open="isOpen">
    <UiDialogContent class="sm:max-w-md" :hide-close="isDeleting">
      <!-- Header with warning icon -->
      <div class="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4">
        <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert class="size-6 text-destructive" />
        </div>
        <div class="flex-1 space-y-2">
          <UiDialogTitle class="text-lg font-semibold">
            {{ title }}
          </UiDialogTitle>
          <UiDialogDescription class="text-sm text-muted-foreground">
            {{ description }}
          </UiDialogDescription>
        </div>
      </div>

      <!-- Item name display -->
      <div class="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p class="text-sm text-muted-foreground mb-1">You are about to delete:</p>
        <p class="font-medium text-foreground break-all">{{ itemName }}</p>
      </div>

      <!-- Confirmation input for dangerous deletes -->
      <div v-if="requireConfirmation" class="mt-4 space-y-2">
        <UiLabel for="confirm-delete" class="text-sm">
          Type <span class="font-mono font-semibold text-destructive">{{ itemName }}</span> to confirm
        </UiLabel>
        <UiInput
          id="confirm-delete"
          v-model="confirmationInput"
          :disabled="isDeleting"
          placeholder="Type the name to confirm..."
          class="font-mono"
          @keyup.enter="handleConfirm"
        />
      </div>

      <!-- Footer with actions -->
      <UiDialogFooter class="mt-6 gap-3 sm:gap-2">
        <UiButton variant="outline" :disabled="isDeleting" @click="handleCancel"> Cancel </UiButton>
        <UiButton variant="destructive" :disabled="!canConfirm || isDeleting" @click="handleConfirm">
          <UiSpinner v-if="isDeleting" class="size-4 mr-2" />
          <Trash2 v-else class="size-4 mr-2" />
          {{ confirmText }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
