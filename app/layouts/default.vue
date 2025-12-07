<script lang="ts" setup>
const appConfig = useAppConfig() as { app?: { name?: string } }
const name = appConfig.app?.name ?? "MetreMate"

const route = useRoute()

// TODO: Replace with actual auth check
const isAdmin = ref(true)

// Navigation structure
const navMain = [
  {
    title: "Dashboard",
    url: "/",
    icon: "lucide:layout-dashboard"
  },
  {
    title: "Projects",
    url: "/projects",
    icon: "lucide:folder-open"
  }
]

const navSupport = [
  {
    title: "Help & Support",
    url: "/support",
    icon: "lucide:help-circle"
  }
]

const navAdmin = [
  {
    title: "Users",
    url: "/users",
    icon: "lucide:users",
    items: [
      { title: "Overview", url: "/users" },
      { title: "Roles", url: "/users/roles" }
    ]
  }
]

// Mock user - replace with your auth composable
const currentUser = {
  name: "Demo User",
  email: "demo@metremate.com",
  initials: "DU"
}

const signOut = () => {
  navigateTo("/login")
}

// Breadcrumb generation from route
const breadcrumbItems = computed(() => {
  const paths = route.path.split("/").filter(Boolean)
  return paths.map((segment, index) => ({
    label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
    link: "/" + paths.slice(0, index + 1).join("/")
  }))
})

useSeoMeta({ title: `${name} - Measure with precision` })
</script>

<template>
  <UiSidebarProvider v-slot="{ isMobile }">
    <UiSidebar collapsible="icon">
      <!-- Header -->
      <UiSidebarHeader>
        <UiSidebarMenu>
          <UiSidebarMenuItem>
            <UiSidebarMenuButton
              as-child
              size="lg"
              class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <NuxtLink to="/">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon name="lucide:ruler" class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ name }}</span>
                  <span class="truncate text-xs text-muted-foreground">Measure with precision</span>
                </div>
              </NuxtLink>
            </UiSidebarMenuButton>
          </UiSidebarMenuItem>
        </UiSidebarMenu>
      </UiSidebarHeader>

      <UiSidebarContent>
        <!-- Main Navigation -->
        <UiSidebarGroup>
          <UiSidebarGroupLabel label="Main" />
          <UiSidebarMenu>
            <UiSidebarMenuItem v-for="item in navMain" :key="item.url">
              <UiSidebarMenuButton as-child :tooltip="item.title">
                <NuxtLink :to="item.url">
                  <Icon :name="item.icon" class="size-4" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </UiSidebarMenuButton>
            </UiSidebarMenuItem>
          </UiSidebarMenu>
        </UiSidebarGroup>

        <!-- Admin Section (conditional) -->
        <UiSidebarGroup v-if="isAdmin">
          <UiSidebarGroupLabel label="Admin" />
          <UiSidebarMenu>
            <template v-for="item in navAdmin" :key="item.url">
              <UiCollapsible v-if="item.items" v-slot="{ open }" as-child>
                <UiSidebarMenuItem>
                  <UiCollapsibleTrigger as-child>
                    <UiSidebarMenuButton :tooltip="item.title">
                      <Icon :name="item.icon" class="size-4" />
                      <span>{{ item.title }}</span>
                      <Icon
                        name="lucide:chevron-right"
                        class="ml-auto size-4 transition-transform duration-200"
                        :class="[open && 'rotate-90']"
                      />
                    </UiSidebarMenuButton>
                  </UiCollapsibleTrigger>
                  <UiCollapsibleContent>
                    <UiSidebarMenuSub>
                      <UiSidebarMenuSubItem v-for="subItem in item.items" :key="subItem.url">
                        <UiSidebarMenuSubButton as-child>
                          <NuxtLink :to="subItem.url">
                            <span>{{ subItem.title }}</span>
                          </NuxtLink>
                        </UiSidebarMenuSubButton>
                      </UiSidebarMenuSubItem>
                    </UiSidebarMenuSub>
                  </UiCollapsibleContent>
                </UiSidebarMenuItem>
              </UiCollapsible>
            </template>
          </UiSidebarMenu>
        </UiSidebarGroup>

        <!-- Support (pushed to bottom) -->
        <UiSidebarGroup class="mt-auto">
          <UiSidebarMenu>
            <UiSidebarMenuItem v-for="item in navSupport" :key="item.url">
              <UiSidebarMenuButton as-child :tooltip="item.title">
                <NuxtLink :to="item.url">
                  <Icon :name="item.icon" class="size-4" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </UiSidebarMenuButton>
            </UiSidebarMenuItem>
          </UiSidebarMenu>
        </UiSidebarGroup>
      </UiSidebarContent>

      <UiSidebarRail />

      <!-- Footer -->
      <UiSidebarFooter>
        <UiSidebarMenu>
          <UiSidebarMenuItem>
            <UiDropdownMenu>
              <UiDropdownMenuTrigger as-child>
                <UiSidebarMenuButton
                  size="lg"
                  variant="outline"
                  class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <UiAvatar class="size-8 rounded-lg">
                    <UiAvatarFallback class="rounded-lg">{{ currentUser.initials }}</UiAvatarFallback>
                  </UiAvatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ currentUser.name }}</span>
                    <span class="truncate text-xs">{{ currentUser.email }}</span>
                  </div>
                  <Icon name="lucide:chevrons-up-down" class="ml-auto size-4" />
                </UiSidebarMenuButton>
              </UiDropdownMenuTrigger>
              <UiDropdownMenuContent
                class="w-[--radix-dropdown-menu-trigger-width] min-w-60 rounded-lg"
                :side="isMobile ? 'bottom' : 'top'"
                :side-offset="4"
                align="end"
              >
                <UiDropdownMenuLabel class="p-0 font-normal">
                  <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UiAvatar class="size-8 rounded-lg">
                      <UiAvatarFallback class="rounded-lg">{{ currentUser.initials }}</UiAvatarFallback>
                    </UiAvatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ currentUser.name }}</span>
                      <span class="truncate text-xs">{{ currentUser.email }}</span>
                    </div>
                  </div>
                </UiDropdownMenuLabel>
                <UiDropdownMenuSeparator />
                <UiDropdownMenuGroup>
                  <NuxtLink to="/settings">
                    <UiDropdownMenuItem title="Settings">
                      <template #icon>
                        <Icon name="lucide:settings" class="size-4" />
                      </template>
                    </UiDropdownMenuItem>
                  </NuxtLink>
                </UiDropdownMenuGroup>
                <UiDropdownMenuSeparator />
                <UiDropdownMenuItem title="Log out" @click="signOut">
                  <template #icon>
                    <Icon name="lucide:log-out" class="size-4" />
                  </template>
                </UiDropdownMenuItem>
              </UiDropdownMenuContent>
            </UiDropdownMenu>
          </UiSidebarMenuItem>
        </UiSidebarMenu>
      </UiSidebarFooter>
    </UiSidebar>

    <!-- Main content -->
    <UiSidebarInset>
      <UiNavbar class="flex relative h-16 shrink-0 items-center gap-2 border-b px-4">
        <UiSidebarTrigger class="-ml-1" />
        <UiDivider orientation="vertical" class="mr-2 h-4 w-px" />
        <UiBreadcrumbs :items="breadcrumbItems" />
        <div class="ml-auto flex items-center gap-2">
          <BackgroundThemeToggle />
        </div>
      </UiNavbar>
      <UiContainer>
        <div class="p-6 rounded-lg">
          <slot />
        </div>
      </UiContainer>
    </UiSidebarInset>
  </UiSidebarProvider>
</template>
