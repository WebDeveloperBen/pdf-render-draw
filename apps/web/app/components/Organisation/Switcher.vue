<script setup lang="ts">
import { Ruler, ChevronsUpDown, Building2, Check, Plus, Loader2 } from "lucide-vue-next"
import { toast } from "vue-sonner"

const runtimeConfig = useRuntimeConfig()
const appName = runtimeConfig.public.app.name

const { activeOrg, organizations, isSwitching, switchOrganization, workspaceName } = useActiveOrganization()

const isOpen = ref(false)
const showCreateDialog = ref(false)
const newOrgName = ref("")
const isCreating = ref(false)

// Handle org switch
const handleSwitch = async (orgId: string) => {
  isOpen.value = false
  await switchOrganization(orgId)
}

// Handle create new workplace
const handleCreateOrg = async () => {
  if (!newOrgName.value.trim()) {
    toast.error("Please enter a workplace name")
    return
  }

  isCreating.value = true
  try {
    const result = await authClient.organization.create({
      name: newOrgName.value.trim(),
      slug: newOrgName.value.trim().toLowerCase().replace(/\s+/g, "-")
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to create workplace")
      return
    }

    toast.success("Workplace created successfully")
    showCreateDialog.value = false
    newOrgName.value = ""

    // Switch to the new organization
    if (result.data?.id) {
      await switchOrganization(result.data.id)
    }
  } catch (error: any) {
    toast.error(error.message || "Failed to create workplace")
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <UiDropdownMenu v-model:open="isOpen">
    <UiDropdownMenuTrigger as-child>
      <UiSidebarMenuButton
        size="lg"
        class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <div
          class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <Ruler class="size-4" />
        </div>
        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-semibold">{{ appName }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ workspaceName }}</span>
        </div>
        <ChevronsUpDown v-if="!isSwitching" class="ml-auto size-4 text-muted-foreground" />
        <Loader2 v-else class="ml-auto size-4 text-muted-foreground animate-spin" />
      </UiSidebarMenuButton>
    </UiDropdownMenuTrigger>

    <UiDropdownMenuContent
      class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
      side="bottom"
      align="start"
      :side-offset="4"
    >
      <UiDropdownMenuLabel class="text-xs text-muted-foreground"> Workplaces </UiDropdownMenuLabel>

      <!-- Workplace list -->
      <UiDropdownMenuItem
        v-for="org in organizations?.data"
        :key="org.id"
        class="gap-2 p-2"
        :class="{ 'bg-accent': activeOrg?.data?.id === org.id }"
        @click="handleSwitch(org.id)"
      >
        <div class="flex size-6 items-center justify-center rounded-sm border bg-background">
          <template v-if="org.logo">
            <img :src="org.logo" :alt="org.name" class="size-4 rounded-sm object-cover" />
          </template>
          <template v-else>
            <Building2 class="size-4" />
          </template>
        </div>
        <span class="flex-1 truncate">{{ org.name }}</span>
        <Check v-if="activeOrg?.data?.id === org.id" class="size-4 text-primary" />
      </UiDropdownMenuItem>

      <UiDropdownMenuSeparator />

      <!-- Create new workplace -->
      <UiDropdownMenuItem class="gap-2 p-2" @click="showCreateDialog = true">
        <div class="flex size-6 items-center justify-center rounded-md border border-dashed bg-background">
          <Plus class="size-4" />
        </div>
        <span class="font-medium text-muted-foreground">Create Workplace</span>
      </UiDropdownMenuItem>
    </UiDropdownMenuContent>
  </UiDropdownMenu>

  <!-- Create Workplace Dialog -->
  <UiDialog v-model:open="showCreateDialog">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>Create Workplace</UiDialogTitle>
        <UiDialogDescription> Create a new workplace to collaborate with your team. </UiDialogDescription>
      </UiDialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <UiLabel for="orgName">Workplace Name</UiLabel>
          <UiInput
            id="orgName"
            v-model="newOrgName"
            placeholder="Acme Construction Co."
            :disabled="isCreating"
            @keyup.enter="handleCreateOrg"
          />
        </div>
      </div>

      <UiDialogFooter>
        <UiButton variant="outline" :disabled="isCreating" @click="showCreateDialog = false"> Cancel </UiButton>
        <UiButton :disabled="isCreating || !newOrgName.trim()" @click="handleCreateOrg">
          <Loader2 v-if="isCreating" class="mr-2 size-4 animate-spin" />
          Create
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
