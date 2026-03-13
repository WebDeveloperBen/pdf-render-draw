<script setup lang="ts">
import { toast } from "vue-sonner"

useSeoMeta({ title: "API Keys" })

// State
const apiKeys = ref<any[]>([])
const isLoading = ref(true)
const isCreating = ref(false)
const isDeleting = ref<string | null>(null)
const showCreateDialog = ref(false)
const newKeyName = ref("")
const newKeyCreated = ref<{ key: string; name: string } | null>(null)

// Fetch API keys
const fetchApiKeys = async () => {
  isLoading.value = true
  try {
    const result = await authClient.apiKey.list()
    if (result.data) {
      apiKeys.value = result.data.apiKeys
    }
  } catch (error: any) {
    toast.error("Failed to load API keys")
  } finally {
    isLoading.value = false
  }
}

// Create API key
const handleCreateKey = async () => {
  if (!newKeyName.value.trim()) {
    toast.error("Please enter a name for the API key")
    return
  }

  isCreating.value = true
  try {
    const result = await authClient.apiKey.create({
      name: newKeyName.value.trim()
    })

    if (result.data) {
      newKeyCreated.value = {
        key: result.data.key,
        name: newKeyName.value.trim()
      }
      await fetchApiKeys()
      newKeyName.value = ""
    }
  } catch (error: any) {
    toast.error(error.message || "Failed to create API key")
  } finally {
    isCreating.value = false
  }
}

// Delete API key
const handleDeleteKey = async (keyId: string) => {
  isDeleting.value = keyId
  try {
    await authClient.apiKey.delete({ keyId })
    apiKeys.value = apiKeys.value.filter((k) => k.id !== keyId)
    toast.success("API key deleted")
  } catch (error: any) {
    toast.error(error.message || "Failed to delete API key")
  } finally {
    isDeleting.value = null
  }
}

// Copy key to clipboard
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success("Copied to clipboard")
}

// Format date
const formatDate = (date: string | Date | null) => {
  if (!date) return "Never"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

// Close dialog and reset
const closeCreateDialog = () => {
  showCreateDialog.value = false
  newKeyName.value = ""
  newKeyCreated.value = null
}

onMounted(() => {
  fetchApiKeys()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <UiButton variant="ghost" size="icon" to="/settings">
        <Icon name="lucide:arrow-left" class="size-4" />
      </UiButton>
      <div class="flex-1">
        <h1 class="text-2xl font-bold tracking-tight">API Keys</h1>
        <p class="text-muted-foreground">Manage your personal API keys for integrations</p>
      </div>
      <UiButton @click="showCreateDialog = true">
        <Icon name="lucide:plus" class="size-4" />
        Create API Key
      </UiButton>
    </div>

    <!-- Info Card -->
    <UiCard class="bg-muted/50">
      <UiCardContent class="flex items-start gap-3 pt-6">
        <Icon name="lucide:info" class="size-5 text-muted-foreground mt-0.5" />
        <div class="text-sm">
          <p class="font-medium">About API Keys</p>
          <p class="text-muted-foreground">
            API keys allow you to authenticate with the API programmatically. Keep your keys secure and never share them
            publicly. You can create multiple keys for different integrations.
          </p>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- API Keys List -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Your API Keys</UiCardTitle>
        <UiCardDescription>View and manage your personal API keys</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon name="svg-spinners:ring-resize" class="size-6 text-muted-foreground" />
        </div>

        <div v-else-if="apiKeys.length === 0" class="text-center py-8 text-muted-foreground">
          <Icon name="lucide:key" class="size-12 mx-auto mb-2 opacity-50" />
          <p>No API keys yet</p>
          <p class="text-sm">Create your first API key to get started</p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="key in apiKeys" :key="key.id" class="flex items-center justify-between p-4 border rounded-lg">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                <Icon name="lucide:key" class="size-5 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">{{ key.name || "Unnamed Key" }}</p>
                <div class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Prefix: {{ key.prefix || key.start || "..." }}</span>
                  <span>Created: {{ formatDate(key.createdAt) }}</span>
                  <span v-if="key.lastRequest">Last used: {{ formatDate(key.lastRequest) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <UiBadge v-if="!key.enabled" variant="secondary">Disabled</UiBadge>
              <UiButton
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive"
                :disabled="isDeleting === key.id"
                @click="handleDeleteKey(key.id)"
              >
                <Icon v-if="isDeleting === key.id" name="svg-spinners:ring-resize" class="size-4" />
                <Icon v-else name="lucide:trash" class="size-4" />
              </UiButton>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Create API Key Dialog -->
    <UiDialog :open="showCreateDialog" @update:open="closeCreateDialog">
      <UiDialogContent>
        <UiDialogHeader>
          <UiDialogTitle>
            {{ newKeyCreated ? "API Key Created" : "Create API Key" }}
          </UiDialogTitle>
          <UiDialogDescription>
            {{
              newKeyCreated
                ? "Make sure to copy your API key now. You won't be able to see it again!"
                : "Give your API key a descriptive name to help you identify it later."
            }}
          </UiDialogDescription>
        </UiDialogHeader>

        <!-- Show created key -->
        <div v-if="newKeyCreated" class="space-y-4 py-4">
          <div class="space-y-2">
            <UiLabel>API Key</UiLabel>
            <div class="flex gap-2">
              <UiInput :model-value="newKeyCreated.key" readonly class="font-mono text-sm" />
              <UiButton variant="outline" size="icon" @click="copyToClipboard(newKeyCreated.key)">
                <Icon name="lucide:copy" class="size-4" />
              </UiButton>
            </div>
          </div>
          <div class="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <div class="flex items-start gap-2">
              <Icon name="lucide:alert-triangle" class="size-4 text-amber-500 mt-0.5" />
              <p class="text-sm text-amber-700 dark:text-amber-300">
                This is the only time you'll see this key. Copy it now and store it securely.
              </p>
            </div>
          </div>
        </div>

        <!-- Create form -->
        <div v-else class="space-y-4 py-4">
          <div class="space-y-2">
            <UiLabel for="keyName">Key Name</UiLabel>
            <UiInput
              id="keyName"
              v-model="newKeyName"
              placeholder="e.g., Production API Key"
              :disabled="isCreating"
              @keyup.enter="handleCreateKey"
            />
          </div>
        </div>

        <UiDialogFooter>
          <UiButton v-if="newKeyCreated" @click="closeCreateDialog"> Done </UiButton>
          <template v-else>
            <UiButton variant="outline" :disabled="isCreating" @click="closeCreateDialog"> Cancel </UiButton>
            <UiButton :disabled="isCreating || !newKeyName.trim()" @click="handleCreateKey">
              <Icon v-if="isCreating" name="svg-spinners:ring-resize" class="size-4" />
              Create Key
            </UiButton>
          </template>
        </UiDialogFooter>
      </UiDialogContent>
    </UiDialog>
  </div>
</template>
