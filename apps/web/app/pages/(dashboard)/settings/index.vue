<script setup lang="ts">
import { ChevronRight, Key, Pencil, Shield, Trash, User } from "lucide-vue-next"
import type { Component } from "vue"

const session = authClient.useSession()
const user = computed(() => session.value?.data?.user)

useSeoMeta({ title: "Settings" })

const settingsSections: Array<{ title: string; description: string; icon: Component; link: string }> = [
  {
    title: "Profile",
    description: "Manage your personal information and preferences",
    icon: User,
    link: "/settings/profile"
  },
  {
    title: "Security",
    description: "Password, sessions, and account security",
    icon: Shield,
    link: "/settings/security"
  },
  {
    title: "API Keys",
    description: "Manage your personal API keys for integrations",
    icon: Key,
    link: "/settings/api-keys"
  }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground">Manage your account settings and preferences</p>
    </div>

    <!-- User Overview Card -->
    <UiCard>
      <UiCardHeader>
        <div class="flex items-center gap-4">
          <UiAvatar class="size-16">
            <UiAvatarImage v-if="user?.image" :src="user.image" />
            <UiAvatarFallback class="text-lg">
              {{ user?.name?.[0]?.toUpperCase() || "?" }}
            </UiAvatarFallback>
          </UiAvatar>
          <div>
            <UiCardTitle class="text-xl">{{ user?.name || "User" }}</UiCardTitle>
            <UiCardDescription>{{ user?.email }}</UiCardDescription>
          </div>
        </div>
      </UiCardHeader>
      <UiCardFooter>
        <UiButton variant="outline" to="/settings/profile">
          <Pencil class="size-4" />
          Edit Profile
        </UiButton>
      </UiCardFooter>
    </UiCard>

    <!-- Settings Sections -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <UiCard
        v-for="section in settingsSections"
        :key="section.link"
        class="cursor-pointer transition-colors hover:bg-muted/50"
        @click="navigateTo(section.link)"
      >
        <UiCardHeader>
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <component :is="section.icon" class="size-5 text-primary" />
            </div>
            <div>
              <UiCardTitle class="text-base">{{ section.title }}</UiCardTitle>
              <UiCardDescription class="text-sm">{{ section.description }}</UiCardDescription>
            </div>
          </div>
        </UiCardHeader>
        <UiCardFooter class="pt-0">
          <ChevronRight class="ml-auto size-4 text-muted-foreground" />
        </UiCardFooter>
      </UiCard>
    </div>

    <!-- Account Actions -->
    <UiCard class="border-destructive/50">
      <UiCardHeader>
        <UiCardTitle class="text-destructive">Danger Zone</UiCardTitle>
        <UiCardDescription>Irreversible account actions</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <UiButton variant="destructive" disabled>
          <Trash class="size-4" />
          Delete Account
        </UiButton>
        <p class="mt-2 text-xs text-muted-foreground">
          Account deletion is not yet available. Contact support if you need to delete your account.
        </p>
      </UiCardContent>
    </UiCard>
  </div>
</template>
