<script lang="ts" setup>
const runtimeConfig = useRuntimeConfig()
const name = runtimeConfig.public.app.name

// Auth session
const session = authClient.useSession()

// Platform admin permissions - vue-query handles fetching automatically
const { platformAdminTier, isPlatformOwner } = usePermissions()

// Current user from session
const currentUser = computed(() => {
  const user = session.value?.data?.user
  if (!user) {
    return { name: "Guest", email: "", initials: "?" }
  }
  const initials =
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.name?.[0]?.toUpperCase() || "?"
  return {
    name: user.name || `${user.firstName} ${user.lastName}`,
    email: user.email,
    initials
  }
})

const { signOut } = useAuth()

// Navigation grouped by function
const navOverview = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: "lucide:layout-dashboard"
  }
]

const navManagement = [
  {
    title: "Users",
    url: "/admin/users",
    icon: "lucide:users"
  },
  {
    title: "Organizations",
    url: "/admin/organizations",
    icon: "lucide:building-2"
  }
]

// Security section - includes owner-only items
const navSecurity = computed(() => {
  const items = []
  if (isPlatformOwner.value) {
    items.push({
      title: "Platform Admins",
      url: "/admin/platform-admins",
      icon: "lucide:shield-check"
    })
  }
  items.push({
    title: "Audit Log",
    url: "/admin/audit-log",
    icon: "lucide:scroll-text"
  })
  return items
})

const navReports = [
  {
    title: "Reports",
    url: "/admin/reports",
    icon: "lucide:bar-chart-3"
  }
]

const navQuickLinks = [
  {
    title: "Back to App",
    url: "/",
    icon: "lucide:arrow-left"
  }
]

// Format tier for display
const tierDisplay = computed(() => {
  const tier = platformAdminTier.value
  if (!tier) return "Admin"
  return tier.charAt(0).toUpperCase() + tier.slice(1)
})

// Breadcrumbs
const { items: breadcrumbItems } = useBreadcrumbs()

useSeoMeta({ title: `Admin - ${name}` })
</script>

<template>
  <div class="min-h-screen">
    <ImpersonationBanner />
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
                <NuxtLink to="/admin">
                  <div
                    class="flex aspect-square size-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground"
                  >
                    <Icon name="lucide:shield" class="size-4" />
                  </div>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ name }} Admin</span>
                    <span class="truncate text-xs text-muted-foreground">Super Admin Panel</span>
                  </div>
                </NuxtLink>
              </UiSidebarMenuButton>
            </UiSidebarMenuItem>
          </UiSidebarMenu>
        </UiSidebarHeader>

        <UiSidebarContent>
          <!-- Overview -->
          <UiSidebarGroup>
            <UiSidebarGroupLabel label="Overview" />
            <UiSidebarMenu>
              <UiSidebarMenuItem v-for="item in navOverview" :key="item.url">
                <UiSidebarMenuButton as-child :tooltip="item.title">
                  <NuxtLink :to="item.url">
                    <Icon :name="item.icon" class="size-4" />
                    <span>{{ item.title }}</span>
                  </NuxtLink>
                </UiSidebarMenuButton>
              </UiSidebarMenuItem>
            </UiSidebarMenu>
          </UiSidebarGroup>

          <!-- Management -->
          <UiSidebarGroup>
            <UiSidebarGroupLabel label="Management" />
            <UiSidebarMenu>
              <UiSidebarMenuItem v-for="item in navManagement" :key="item.url">
                <UiSidebarMenuButton as-child :tooltip="item.title">
                  <NuxtLink :to="item.url">
                    <Icon :name="item.icon" class="size-4" />
                    <span>{{ item.title }}</span>
                  </NuxtLink>
                </UiSidebarMenuButton>
              </UiSidebarMenuItem>
            </UiSidebarMenu>
          </UiSidebarGroup>

          <!-- Security -->
          <UiSidebarGroup>
            <UiSidebarGroupLabel label="Security" />
            <UiSidebarMenu>
              <UiSidebarMenuItem v-for="item in navSecurity" :key="item.url">
                <UiSidebarMenuButton as-child :tooltip="item.title">
                  <NuxtLink :to="item.url">
                    <Icon :name="item.icon" class="size-4" />
                    <span>{{ item.title }}</span>
                  </NuxtLink>
                </UiSidebarMenuButton>
              </UiSidebarMenuItem>
            </UiSidebarMenu>
          </UiSidebarGroup>

          <!-- Reports -->
          <UiSidebarGroup>
            <UiSidebarGroupLabel label="Reports" />
            <UiSidebarMenu>
              <UiSidebarMenuItem v-for="item in navReports" :key="item.url">
                <UiSidebarMenuButton as-child :tooltip="item.title">
                  <NuxtLink :to="item.url">
                    <Icon :name="item.icon" class="size-4" />
                    <span>{{ item.title }}</span>
                  </NuxtLink>
                </UiSidebarMenuButton>
              </UiSidebarMenuItem>
            </UiSidebarMenu>
          </UiSidebarGroup>

          <!-- Quick Links (pushed to bottom) -->
          <UiSidebarGroup class="mt-auto">
            <UiSidebarMenu>
              <UiSidebarMenuItem v-for="item in navQuickLinks" :key="item.url">
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
                    <NuxtLink to="/">
                      <UiDropdownMenuItem title="Back to App">
                        <template #icon>
                          <Icon name="lucide:arrow-left" class="size-4" />
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
            <UiBadge variant="destructive" class="gap-1">
              <Icon name="lucide:shield" class="size-3" />
              {{ tierDisplay }}
            </UiBadge>
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
  </div>
</template>
