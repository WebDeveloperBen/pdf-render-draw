<script setup lang="ts">
import type { ProjectShareWithRelations } from "#shared/types/projects.types"
import { toast } from "vue-sonner"
import { Download, Globe, Link, MessageSquare, Send, Users } from "lucide-vue-next"

const props = defineProps<{
  projectId: string
  projectName: string
}>()

const open = defineModel<boolean>("open", { default: false })

const emit = defineEmits<{
  created: [share: ProjectShareWithRelations]
}>()

const isCreating = ref(false)
const newShare = ref({
  name: "",
  shareType: "public" as "public" | "private",
  recipients: [] as string[],
  message: "",
  expiresAt: null as Date | null,
  password: "",
  allowDownload: true,
  allowNotes: false
})

const expirationOptions = [
  { label: "Never", value: null },
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 }
]
const selectedExpiration = ref<number | null>(null)

watch(selectedExpiration, (days) => {
  if (days === null) {
    newShare.value.expiresAt = null
  } else {
    const date = new Date()
    date.setDate(date.getDate() + days)
    newShare.value.expiresAt = date
  }
})

function reset() {
  newShare.value = {
    name: "",
    shareType: "public",
    recipients: [],
    message: "",
    expiresAt: null,
    password: "",
    allowDownload: true,
    allowNotes: false
  }
  selectedExpiration.value = null
}

async function handleCreate() {
  if (newShare.value.shareType === "private" && newShare.value.recipients.length === 0) {
    toast.error("Please add at least one recipient for private shares")
    return
  }

  isCreating.value = true
  try {
    const share = await $fetch<ProjectShareWithRelations>(`/api/projects/${props.projectId}/shares`, {
      method: "POST",
      body: {
        name: newShare.value.name || undefined,
        shareType: newShare.value.shareType,
        recipients: newShare.value.shareType === "private" ? newShare.value.recipients : undefined,
        message: newShare.value.message || undefined,
        expiresAt: newShare.value.expiresAt,
        password: newShare.value.password || null,
        allowDownload: newShare.value.allowDownload,
        allowNotes: newShare.value.allowNotes
      }
    })

    emit("created", share)

    if (newShare.value.shareType === "private") {
      toast.success(`Invitations sent to ${newShare.value.recipients.length} recipient(s)`)
    } else {
      toast.success("Share link created")
    }

    open.value = false
    reset()
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to create share")
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open">
    <UiDialogContent class="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <UiDialogHeader>
        <UiDialogTitle>Share Project</UiDialogTitle>
        <UiDialogDescription>
          Share <span class="font-medium text-foreground">{{ projectName }}</span> with others
        </UiDialogDescription>
      </UiDialogHeader>

      <div class="space-y-5 py-4">
        <!-- Share Type Tabs -->
        <div class="space-y-2">
          <UiLabel>Share with</UiLabel>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              :class="[
                'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                newShare.shareType === 'public'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              ]"
              :disabled="isCreating"
              @click="newShare.shareType = 'public'"
            >
              <div
                :class="[
                  'flex size-9 items-center justify-center rounded-lg',
                  newShare.shareType === 'public' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                ]"
              >
                <Globe class="size-4" />
              </div>
              <div>
                <p class="font-medium text-sm">Anyone with link</p>
                <p class="text-xs text-muted-foreground">Public, view only</p>
              </div>
            </button>

            <button
              type="button"
              :class="[
                'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                newShare.shareType === 'private'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              ]"
              :disabled="isCreating"
              @click="newShare.shareType = 'private'"
            >
              <div
                :class="[
                  'flex size-9 items-center justify-center rounded-lg',
                  newShare.shareType === 'private' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                ]"
              >
                <Users class="size-4" />
              </div>
              <div>
                <p class="font-medium text-sm">Specific people</p>
                <p class="text-xs text-muted-foreground">Invite via email</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Recipients (for private shares) -->
        <div v-if="newShare.shareType === 'private'" class="space-y-2">
          <UiLabel>Recipients</UiLabel>
          <ShareRecipientInput
            v-model="newShare.recipients"
            :disabled="isCreating"
            placeholder="Enter email addresses..."
          />
        </div>

        <!-- Two column layout for optional fields -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <UiLabel for="share-name">Name</UiLabel>
              <span class="text-xs text-muted-foreground">optional</span>
            </div>
            <UiInput
              id="share-name"
              v-model="newShare.name"
              placeholder="e.g., Phase 1 Review"
              :disabled="isCreating"
            />
          </div>

          <div class="space-y-2">
            <UiLabel for="share-expiration">Expires</UiLabel>
            <UiSelect v-model="selectedExpiration" :disabled="isCreating">
              <UiSelectTrigger id="share-expiration">
                <UiSelectValue placeholder="Never" />
              </UiSelectTrigger>
              <UiSelectContent>
                <UiSelectItem v-for="option in expirationOptions" :key="option.label" :value="option.value">
                  {{ option.label }}
                </UiSelectItem>
              </UiSelectContent>
            </UiSelect>
          </div>

          <div v-if="newShare.shareType === 'public'" class="space-y-2">
            <div class="flex items-center gap-2">
              <UiLabel for="share-password">Password</UiLabel>
              <span class="text-xs text-muted-foreground">optional</span>
            </div>
            <UiInput
              id="share-password"
              v-model="newShare.password"
              type="password"
              placeholder="Leave empty for no password"
              :disabled="isCreating"
            />
          </div>

          <div v-if="newShare.shareType === 'private'" class="space-y-2 sm:col-span-2">
            <div class="flex items-center gap-2">
              <UiLabel for="share-message">Message</UiLabel>
              <span class="text-xs text-muted-foreground">optional</span>
            </div>
            <UiTextarea
              id="share-message"
              v-model="newShare.message"
              placeholder="Add a message for recipients..."
              :disabled="isCreating"
              :rows="2"
            />
          </div>
        </div>

        <UiDivider />

        <!-- Permissions -->
        <div class="space-y-3">
          <span class="text-sm font-medium">Permissions</span>
          <div class="flex flex-wrap gap-x-8 gap-y-3">
            <label class="flex items-center gap-3 cursor-pointer">
              <UiSwitch
                :checked="newShare.allowDownload"
                :disabled="isCreating"
                @update:checked="newShare.allowDownload = $event"
              />
              <div class="flex items-center gap-2">
                <Download class="size-4 text-muted-foreground" />
                <span class="text-sm">Allow download</span>
              </div>
            </label>

            <label v-if="newShare.shareType === 'private'" class="flex items-center gap-3 cursor-pointer">
              <UiSwitch
                :checked="newShare.allowNotes"
                :disabled="isCreating"
                @update:checked="newShare.allowNotes = $event"
              />
              <div class="flex items-center gap-2">
                <MessageSquare class="size-4 text-muted-foreground" />
                <span class="text-sm">Allow notes</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <UiDialogFooter class="gap-3">
        <UiButton variant="outline" :disabled="isCreating" @click="open = false">Cancel</UiButton>
        <UiButton :disabled="isCreating" @click="handleCreate">
          <UiSpinner v-if="isCreating" class="size-4" />
          <template v-else>
            <Send v-if="newShare.shareType === 'private'" class="size-4" />
            <Link v-else class="size-4" />
          </template>
          {{ newShare.shareType === "private" ? "Send Invitations" : "Create Link" }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
