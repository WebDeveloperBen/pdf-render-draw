<script lang="ts" setup>
import {
  Command,
  GalleryVerticalEnd,
  Settings2,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Users,
  Layers,
  Shield,
  Server,
  Database,
  Bot
} from "lucide-vue-next"

const {
  app: { name }
} = useAppConfig()

const data = {
  teams: [
    {
      name,
      logo: GalleryVerticalEnd,
      plan: "Production"
    },
    {
      name: "Development",
      logo: Command,
      plan: "Dev"
    }
  ],
  navMain: [
    {
      title: "Applications",
      url: "/applications",
      icon: Layers,
      isActive: true
    },
    {
      title: "Knowledge",
      url: "/knowledge",
      icon: Database
    }
  ],
  navPlayground: [
    {
      title: "Prompts",
      icon: Layers,
      url: "/prompts",
      isActive: true
    },
    {
      title: "Playground",
      url: "/playground",
      icon: Server
    }
  ],
  // navObservability: [
  //   { title: "Analytics", url: "/observability/analytics", icon: LineChart },
  //   {
  //     title: "Monitoring",
  //     url: "/observability/logs",
  //     icon: FileText
  //   }
  // ],
  navGovernance: [
    {
      title: "Policies",
      url: "/governance/policies",
      icon: Shield
    }
  ],
  navAdmin: [
    {
      title: "Users",
      url: "/users",
      icon: Users,
      items: [
        {
          title: "Overview",
          url: "/users"
        },
        {
          title: "Roles",
          url: "/users/roles"
        }
      ]
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2
    }
  ]
}

useSeoMeta({ title: "Admin Dashboard" })
</script>
<template>
  <UiSidebarProvider v-slot="{ isMobile }">
    <!-- App Sidebar -->
    <UiSidebar collapsible="icon">
      <UiSidebarHeader>
        <UiSidebarMenu>
          <UiSidebarMenuItem>
            <UiSidebarMenuButton
              as-child
              size="lg"
              class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <NuxtLink to="/">
                <div
                  class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
                >
                  <img src="/logo.svg" alt="Logo" class="size-4 brightness-0 invert" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">{{ name }}</span>
                </div>
              </NuxtLink>
            </UiSidebarMenuButton>
          </UiSidebarMenuItem>
        </UiSidebarMenu>
      </UiSidebarHeader>
      <UiSidebarContent>
        <!-- Platform -->
        <UiSidebarGroup>
          <UiSidebarGroupLabel label="Platform" />
          <UiSidebarMenu>
            <UiSidebarMenuItem v-for="(item, index) in data.navMain" :key="index">
              <UiSidebarMenuButton as-child :tooltip="item.title">
                <NuxtLink :href="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </UiSidebarMenuButton>
            </UiSidebarMenuItem>
          </UiSidebarMenu>
        </UiSidebarGroup>

        <!-- Governance -->
        <UiSidebarGroup>
          <UiSidebarGroupLabel label="Governance" />
          <UiSidebarMenu>
            <UiSidebarMenuItem v-for="(item, index) in data.navGovernance" :key="index">
              <UiSidebarMenuButton as-child :tooltip="item.title">
                <NuxtLink :href="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </NuxtLink>
              </UiSidebarMenuButton>
            </UiSidebarMenuItem>
          </UiSidebarMenu>
        </UiSidebarGroup>
        <!-- Observability -->
        <!-- <UiSidebarGroup> -->
        <!--   <UiSidebarGroupLabel label="Observability" /> -->
        <!--   <UiSidebarMenu> -->
        <!--     <template v-for="(item, index) in data.navObservability" :key="index"> -->
        <!--       Items with sub-items -->
        <!--       <UiSidebarMenuButton as-child :tooltip="item.title"> -->
        <!--         <NuxtLink :href="item.url"> -->
        <!--           <component :is="item.icon" /> -->
        <!--           <span>{{ item.title }}</span> -->
        <!--         </NuxtLink> -->
        <!--       </UiSidebarMenuButton> -->
        <!--     </template> -->
        <!--   </UiSidebarMenu> -->
        <!-- </UiSidebarGroup> -->
        <UiSidebarGroup>
          <UiSidebarGroupLabel label="Administration" />
          <UiSidebarMenu>
            <template v-for="(item, index) in data.navAdmin" :key="index">
              <!-- Items with sub-items -->
              <UiCollapsible v-if="item.items" v-slot="{ open }" as-child>
                <UiSidebarMenuItem>
                  <UiCollapsibleTrigger as-child>
                    <UiSidebarMenuButton :tooltip="item.title">
                      <component :is="item.icon" />
                      <span>{{ item.title }}</span>
                      <component
                        :is="ChevronRight"
                        class="ml-auto transition-transform duration-200"
                        :class="[open && 'rotate-90']"
                      />
                    </UiSidebarMenuButton>
                  </UiCollapsibleTrigger>
                  <UiCollapsibleContent>
                    <UiSidebarMenuSub>
                      <UiSidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
                        <UiSidebarMenuSubButton as-child>
                          <NuxtLink :href="subItem.url">
                            <span>{{ subItem.title }}</span>
                          </NuxtLink>
                        </UiSidebarMenuSubButton>
                      </UiSidebarMenuSubItem>
                    </UiSidebarMenuSub>
                  </UiCollapsibleContent>
                </UiSidebarMenuItem>
              </UiCollapsible>
              <!-- Items without sub-items -->
              <UiSidebarMenuItem v-else>
                <UiSidebarMenuButton as-child :tooltip="item.title">
                  <NuxtLink :href="item.url">
                    <component :is="item.icon" />
                    <span>{{ item.title }}</span>
                  </NuxtLink>
                </UiSidebarMenuButton>
              </UiSidebarMenuItem>
            </template>
          </UiSidebarMenu>
        </UiSidebarGroup>
      </UiSidebarContent>
      <UiSidebarRail />
      <!-- Footer-->
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
                  <component :is="ChevronsUpDown" class="ml-auto size-4" />
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
                    <UiDropdownMenuItem :icon="Settings2" title="Settings" />
                  </NuxtLink>
                </UiDropdownMenuGroup>
                <UiDropdownMenuSeparator />
                <UiDropdownMenuItem :icon="LogOut" title="Log out" @click="signOut" />
              </UiDropdownMenuContent>
            </UiDropdownMenu>
          </UiSidebarMenuItem>
        </UiSidebarMenu>
      </UiSidebarFooter>
    </UiSidebar>
    <!-- Sidebar main content -->
    <UiSidebarInset>
      <!-- Navbar -->
      <UiNavbar class="flex relative h-16 shrink-0 items-center gap-2 border-b px-4">
        <UiSidebarTrigger class="-ml-1" />
        <UiDivider orientation="vertical" class="mr-2 h-4 w-px" />
        <UiBreadcrumbs :items="breadcrumbItems" />
        <div class="ml-auto">
          <ThemeToggle />
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
