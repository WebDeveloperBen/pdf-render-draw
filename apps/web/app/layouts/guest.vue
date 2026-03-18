<script lang="ts" setup>
import { Sparkles, ArrowRight, Ruler, ChevronDown, FolderOpen, LogOut } from "lucide-vue-next"

const runtimeConfig = useRuntimeConfig()
const name = runtimeConfig.public.app.name

// Auth session
const session = authClient.useSession()

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

useSeoMeta({ title: `${name} - Shared with you` })
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Upgrade Banner -->
    <div class="bg-primary/10 border-b border-primary/20">
      <div class="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2 text-sm">
            <Sparkles class="size-4 text-primary" />
            <span class="text-muted-foreground">
              You're viewing shared content.
              <span class="font-medium text-foreground">Create your own projects with a free account.</span>
            </span>
          </div>
          <NuxtLink to="/g/upgrade">
            <UiButton size="sm" variant="outline" class="h-7 text-xs">
              Create Free Account
              <ArrowRight class="ml-1 size-3" />
            </UiButton>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Header -->
    <header class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">
          <!-- Logo -->
          <NuxtLink to="/g" class="flex items-center gap-2">
            <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Ruler class="size-4" />
            </div>
            <span class="font-semibold">{{ name }}</span>
          </NuxtLink>

          <!-- Right side -->
          <div class="flex items-center gap-4">
            <BackgroundThemeToggle />

            <!-- User dropdown -->
            <UiDropdownMenu>
              <UiDropdownMenuTrigger as-child>
                <UiButton variant="ghost" class="relative h-8 gap-2 pl-2 pr-3">
                  <UiAvatar class="size-6">
                    <UiAvatarFallback class="text-xs">{{ currentUser.initials }}</UiAvatarFallback>
                  </UiAvatar>
                  <span class="hidden text-sm sm:inline-block">{{ currentUser.name }}</span>
                  <ChevronDown class="size-3 text-muted-foreground" />
                </UiButton>
              </UiDropdownMenuTrigger>
              <UiDropdownMenuContent align="end" class="w-56">
                <UiDropdownMenuLabel class="font-normal">
                  <div class="flex flex-col space-y-1">
                    <p class="text-sm font-medium leading-none">{{ currentUser.name }}</p>
                    <p class="text-xs leading-none text-muted-foreground">{{ currentUser.email }}</p>
                  </div>
                </UiDropdownMenuLabel>
                <UiDropdownMenuSeparator />
                <NuxtLink to="/g">
                  <UiDropdownMenuItem title="Shared Projects">
                    <template #icon>
                      <FolderOpen class="size-4" />
                    </template>
                  </UiDropdownMenuItem>
                </NuxtLink>
                <UiDropdownMenuSeparator />
                <UiDropdownMenuItem title="Sign Out" @click="signOut">
                  <template #icon>
                    <LogOut class="size-4" />
                  </template>
                </UiDropdownMenuItem>
              </UiDropdownMenuContent>
            </UiDropdownMenu>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
