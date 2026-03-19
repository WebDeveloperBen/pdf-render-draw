<script setup lang="ts">
import { ChevronsUpDown, Search, Loader2, Check, X } from "lucide-vue-next"
import { useDebounceFn } from "@vueuse/core"
import { getApiAdminUsers } from "~/models/api"
import type { GetApiAdminUsers200UsersItem } from "~/models/api"
import { expectSuccessData } from "~/utils/customFetch"

const props = defineProps<{
  placeholder?: string
}>()

const emit = defineEmits<{
  select: [user: GetApiAdminUsers200UsersItem]
}>()

const modelValue = defineModel<string>({ default: "" })

const searchQuery = ref("")
const isOpen = ref(false)
const isLoading = ref(false)
const users = ref<GetApiAdminUsers200UsersItem[]>([])
const selectedUser = ref<GetApiAdminUsers200UsersItem | null>(null)

// Search users with debounce
const searchUsers = useDebounceFn(async () => {
  if (!searchQuery.value || searchQuery.value.length < 2) {
    users.value = []
    return
  }

  isLoading.value = true
  try {
    const response = await getApiAdminUsers({
      search: searchQuery.value,
      limit: 10,
      sortBy: "name",
      sortOrder: "asc"
    })
    users.value = expectSuccessData(response, "Failed to search users").users.filter(Boolean)
  } catch (error) {
    console.error("Failed to search users:", error)
    users.value = []
  } finally {
    isLoading.value = false
  }
}, 300)

watch(searchQuery, () => {
  searchUsers()
})

const selectUser = (user: GetApiAdminUsers200UsersItem) => {
  selectedUser.value = user
  modelValue.value = user.id
  emit("select", user)
  isOpen.value = false
  searchQuery.value = ""
}

const clearSelection = () => {
  selectedUser.value = null
  modelValue.value = ""
  searchQuery.value = ""
}
</script>

<template>
  <UiPopover v-model:open="isOpen">
    <UiPopoverTrigger as-child>
      <UiButton variant="outline" role="combobox" :aria-expanded="isOpen" class="w-full justify-between font-normal">
        <div v-if="selectedUser" class="flex items-center gap-2 truncate">
          <UiAvatar class="size-6">
            <UiAvatarImage v-if="selectedUser.image" :src="selectedUser.image" :alt="selectedUser.name || 'User'" />
            <UiAvatarFallback class="text-xs">{{
              (selectedUser.name || selectedUser.email)[0]?.toUpperCase()
            }}</UiAvatarFallback>
          </UiAvatar>
          <span class="truncate">{{ selectedUser.name || selectedUser.email }}</span>
        </div>
        <span v-else class="text-muted-foreground">{{ placeholder || "Search users..." }}</span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </UiButton>
    </UiPopoverTrigger>
    <UiPopoverContent class="w-[400px] p-0" align="start">
      <div class="flex items-center border-b px-3">
        <Search class="mr-2 size-4 shrink-0 opacity-50" />
        <input
          v-model="searchQuery"
          placeholder="Type to search users..."
          class="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Loader2 v-if="isLoading" class="size-4 animate-spin opacity-50" />
      </div>
      <div class="max-h-[300px] overflow-y-auto p-1">
        <div
          v-if="searchQuery.length > 0 && searchQuery.length < 2"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          Type at least 2 characters to search
        </div>
        <div
          v-else-if="!isLoading && searchQuery.length >= 2 && users.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          No users found
        </div>
        <template v-else>
          <button
            v-for="user in users"
            :key="user.id"
            class="relative flex w-full cursor-pointer select-none items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            @click="selectUser(user)"
          >
            <UiAvatar class="size-8">
              <UiAvatarImage v-if="user.image" :src="user.image" :alt="user.name || 'User'" />
              <UiAvatarFallback>{{ (user.name || user.email)[0]?.toUpperCase() }}</UiAvatarFallback>
            </UiAvatar>
            <div class="flex-1 text-left">
              <p class="font-medium">{{ user.name || "No name" }}</p>
              <p class="text-xs text-muted-foreground">{{ user.email }}</p>
            </div>
            <Check v-if="selectedUser?.id === user.id" class="size-4 text-primary" />
          </button>
        </template>
      </div>
      <div v-if="selectedUser" class="border-t p-2">
        <UiButton variant="ghost" size="sm" class="w-full" @click="clearSelection">
          <X class="size-4 mr-2" />
          Clear selection
        </UiButton>
      </div>
    </UiPopoverContent>
  </UiPopover>
</template>
