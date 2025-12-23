<script lang="ts" setup>
const runtimeConfig = useRuntimeConfig()
const name = runtimeConfig.public.app.name

// Auth session
const session = authClient.useSession()

// Organization state
const { isOrgAdmin, hasActiveOrganization, ensureActiveOrganization } = useActiveOrganization()

// Permission checks (including platform admin for admin panel)
// vue-query handles fetching automatically when session is ready
const { isPlatformAdmin } = usePermissions()

// Ensure organization is active when session is ready
watch(
  () => session.value?.data?.user,
  async (user) => {
    if (user) {
      await ensureActiveOrganization()
    }
  },
  { immediate: true }
)

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

// Workplace navigation (shown when a workplace is active)
const navOrg = computed(() => {
  if (!hasActiveOrganization.value) return []
  return [
    {
      title: "Workplace",
      url: "/organisation",
      icon: "lucide:building-2",
      items: [
        { title: "Overview", url: "/organisation" },
        ...(isOrgAdmin.value
          ? [
              { title: "Members", url: "/organisation/members" },
              { title: "Invitations", url: "/organisation/invitations" },
              { title: "Settings", url: "/organisation/settings" }
            ]
          : [])
      ]
    }
  ]
})

const navAccount = [
  {
    title: "Settings",
    url: "/settings",
    icon: "lucide:settings"
  },
  {
    title: "Help & Support",
    url: "/support",
    icon: "lucide:help-circle"
  }
]

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

// Breadcrumbs
const { items: breadcrumbItems } = useBreadcrumbs()

useSeoMeta({ title: `${name} - Measure with precision` })
</script>

<template>
  <div class="min-h-screen">
    <ImpersonationBanner />
    <UiSidebarProvider v-slot="{ isMobile }">
      <UiSidebar collapsible="icon">
        <!-- Header with Workplace Switcher -->
        <UiSidebarHeader>
          <UiSidebarMenu>
            <UiSidebarMenuItem>
              <OrganisationSwitcher />
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

          <!-- Workplace Section (shown when in a workplace) -->
          <UiSidebarGroup v-if="navOrg.length > 0">
            <UiSidebarGroupLabel label="Workplace" />
            <UiSidebarMenu>
              <template v-for="item in navOrg" :key="item.url">
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

          <!-- Account (pushed to bottom) -->
          <UiSidebarGroup class="mt-auto">
            <UiSidebarGroupLabel label="Account" />
            <UiSidebarMenu>
              <UiSidebarMenuItem v-for="item in navAccount" :key="item.url">
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

        <!-- Pricing CTA -->
        <SidebarPricingCta />

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
                  <!-- Admin Panel (platform admin only) -->
                  <template v-if="isPlatformAdmin">
                    <UiDropdownMenuSeparator />
                    <UiDropdownMenuGroup>
                      <NuxtLink to="/admin">
                        <UiDropdownMenuItem title="Admin Panel">
                          <template #icon>
                            <Icon name="lucide:shield" class="size-4" />
                          </template>
                        </UiDropdownMenuItem>
                      </NuxtLink>
                    </UiDropdownMenuGroup>
                  </template>
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
  </div>
</template>
