<script setup lang="ts">
import { toast } from "vue-sonner"

const { activeOrg, organizations, isSwitching, switchOrganization, workspaceName, isPersonalWorkspace } =
  useActiveOrganization()

const isOpen = ref(false)
const showCreateDialog = ref(false)
const newOrgName = ref("")
const isCreating = ref(false)

// Handle org switch
const handleSwitch = async (orgId: string | null) => {
  isOpen.value = false
  await switchOrganization(orgId)
}

// Handle create new organization
const handleCreateOrg = async () => {
  if (!newOrgName.value.trim()) {
    toast.error("Please enter an organization name")
    return
  }

  isCreating.value = true
  try {
    const result = await authClient.organization.create({
      name: newOrgName.value.trim(),
      slug: newOrgName.value.trim().toLowerCase().replace(/\s+/g, "-")
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to create organization")
      return
    }

    toast.success("Organization created successfully")
    showCreateDialog.value = false
    newOrgName.value = ""

    // Switch to the new organization
    if (result.data?.id) {
      await switchOrganization(result.data.id)
    }
  } catch (error: any) {
    toast.error(error.message || "Failed to create organization")
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
        <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon :name="isPersonalWorkspace ? 'lucide:user' : 'lucide:building-2'" class="size-4 text-primary" />
        </div>
        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-semibold">{{ workspaceName }}</span>
          <span class="truncate text-xs text-muted-foreground">
            {{ isPersonalWorkspace ? "Personal" : "Organization" }}
          </span>
        </div>
        <Icon v-if="!isSwitching" name="lucide:chevrons-up-down" class="ml-auto size-4 text-muted-foreground" />
        <Icon v-else name="svg-spinners:ring-resize" class="ml-auto size-4 text-muted-foreground" />
      </UiSidebarMenuButton>
    </UiDropdownMenuTrigger>

    <UiDropdownMenuContent
      class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
      side="bottom"
      align="start"
      :side-offset="4"
    >
      <UiDropdownMenuLabel class="text-xs text-muted-foreground"> Workspaces </UiDropdownMenuLabel>

      <!-- Personal Workspace -->
      <UiDropdownMenuItem class="gap-2 p-2" :class="{ 'bg-accent': isPersonalWorkspace }" @click="handleSwitch(null)">
        <div class="flex size-6 items-center justify-center rounded-sm border bg-background">
          <Icon name="lucide:user" class="size-4" />
        </div>
        <span class="flex-1 truncate">Personal Workspace</span>
        <Icon v-if="isPersonalWorkspace" name="lucide:check" class="size-4 text-primary" />
      </UiDropdownMenuItem>

      <UiDropdownMenuSeparator v-if="organizations?.data?.length" />

      <!-- Organization list -->
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
            <Icon name="lucide:building-2" class="size-4" />
          </template>
        </div>
        <span class="flex-1 truncate">{{ org.name }}</span>
        <Icon v-if="activeOrg?.data?.id === org.id" name="lucide:check" class="size-4 text-primary" />
      </UiDropdownMenuItem>

      <UiDropdownMenuSeparator />

      <!-- Create new organization -->
      <UiDropdownMenuItem class="gap-2 p-2" @click="showCreateDialog = true">
        <div class="flex size-6 items-center justify-center rounded-md border border-dashed bg-background">
          <Icon name="lucide:plus" class="size-4" />
        </div>
        <span class="font-medium text-muted-foreground">Create Organization</span>
      </UiDropdownMenuItem>
    </UiDropdownMenuContent>
  </UiDropdownMenu>

  <!-- Create Organization Dialog -->
  <UiDialog v-model:open="showCreateDialog">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>Create Organization</UiDialogTitle>
        <UiDialogDescription> Create a new organization to collaborate with your team. </UiDialogDescription>
      </UiDialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <UiLabel for="orgName">Organization Name</UiLabel>
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
          <Icon v-if="isCreating" name="svg-spinners:ring-resize" class="mr-2 size-4" />
          Create
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
