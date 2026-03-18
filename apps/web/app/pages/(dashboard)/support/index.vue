<script setup lang="ts">
import { Search, Rocket, Ruler, PenTool, FolderOpen, CreditCard, ArrowRight } from "lucide-vue-next"
import type { Component } from "vue"
import faqData from "@/data/faq.json"

useSeoMeta({ title: "Help & Support" })

const runtimeConfig = useRuntimeConfig()
const appName = runtimeConfig.public.app.name

interface CategoryStyle {
  icon: Component
  iconColor: string
  bgColor: string
  borderHover: string
}

const categoryStyles: Record<string, CategoryStyle> = {
  rocket: {
    icon: Rocket,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-950",
    borderHover: "group-hover:border-blue-300"
  },
  ruler: {
    icon: Ruler,
    iconColor: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-950",
    borderHover: "group-hover:border-amber-300"
  },
  "pen-tool": {
    icon: PenTool,
    iconColor: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-950",
    borderHover: "group-hover:border-violet-300"
  },
  "folder-open": {
    icon: FolderOpen,
    iconColor: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-950",
    borderHover: "group-hover:border-emerald-300"
  },
  "credit-card": {
    icon: CreditCard,
    iconColor: "text-rose-600",
    bgColor: "bg-rose-100 dark:bg-rose-950",
    borderHover: "group-hover:border-rose-300"
  }
}

function getArticleCount(slug: string) {
  return faqData.items.filter((item) => item.category === slug).length
}

// Search
const searchQuery = ref("")
const isSearching = computed(() => searchQuery.value.trim().length >= 2)

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (query.length < 2) return []
  return faqData.items.filter(
    (item) => item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query)
  )
})

function getCategoryName(slug: string) {
  return faqData.categories.find((c) => c.slug === slug)?.name ?? slug
}
</script>

<template>
  <div class="space-y-10">
    <!-- Hero header -->
    <div class="relative overflow-hidden rounded-2xl border bg-card px-6 py-12 sm:px-10">
      <div class="relative z-10 max-w-lg">
        <h1 class="text-3xl font-bold tracking-tight lg:text-4xl">Welcome to {{ appName }} Support</h1>
        <p class="mt-3 text-muted-foreground">
          Find answers to common questions, learn how to use the tools, or get in touch with our team.
        </p>

        <!-- Search -->
        <div class="relative mt-8 max-w-md">
          <Search class="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <UiInput
            v-model="searchQuery"
            placeholder="How can we help you?"
            class="h-12 rounded-xl pl-11 text-base shadow-sm"
          />
        </div>
      </div>
      <img
        src="/house_support.svg"
        alt=""
        class="pointer-events-none absolute right-4 bottom-0 hidden h-48 select-none opacity-80 lg:block xl:h-56"
      />
    </div>

    <!-- Search results -->
    <template v-if="isSearching">
      <div>
        <h2 class="mb-4 text-lg font-semibold">
          {{ searchResults.length }} result{{ searchResults.length === 1 ? "" : "s" }} for "{{ searchQuery }}"
        </h2>

        <UiAccordion v-if="searchResults.length" type="single" collapsible class="w-full space-y-2">
          <UiAccordionItem
            v-for="(item, i) in searchResults"
            :key="`search-${i}`"
            :value="`search-${i}`"
            class="rounded-lg border bg-card px-4 py-1 last:border-b"
          >
            <UiAccordionTrigger class="w-full py-2 text-[15px] leading-6 hover:no-underline">
              <div class="flex flex-col items-start gap-0.5">
                <span>{{ item.question }}</span>
                <span class="text-xs font-normal text-muted-foreground">{{ getCategoryName(item.category) }}</span>
              </div>
            </UiAccordionTrigger>
            <UiAccordionContent class="text-muted-foreground">
              {{ item.answer }}
            </UiAccordionContent>
          </UiAccordionItem>
        </UiAccordion>

        <div v-else class="py-12 text-center">
          <p class="text-muted-foreground">No results found. Try a different search term or browse the topics below.</p>
        </div>
      </div>
    </template>

    <!-- Category grid -->
    <template v-if="!isSearching">
      <div>
        <h2 class="mb-1 text-xl font-semibold">Browse by topic</h2>
        <p class="mb-6 text-muted-foreground">Pick a category to find what you need.</p>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink v-for="cat in faqData.categories" :key="cat.slug" :to="`/support/${cat.slug}`" class="group">
            <UiCard
              :class="[
                'h-full transition-all duration-200 group-hover:shadow-md',
                categoryStyles[cat.icon]?.borderHover
              ]"
            >
              <UiCardContent class="flex flex-col items-center gap-4 p-6 text-center">
                <div
                  :class="['flex size-14 items-center justify-center rounded-2xl', categoryStyles[cat.icon]?.bgColor]"
                >
                  <component
                    :is="categoryStyles[cat.icon]?.icon"
                    :class="['size-7', categoryStyles[cat.icon]?.iconColor]"
                  />
                </div>
                <div>
                  <p class="font-semibold">{{ cat.name }}</p>
                  <p class="mt-1 text-sm text-muted-foreground">{{ cat.description }}</p>
                </div>
                <span
                  class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                >
                  {{ getArticleCount(cat.slug) }} articles
                  <ArrowRight class="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </UiCardContent>
            </UiCard>
          </NuxtLink>
        </div>
      </div>

      <BlocksSupportCta />
    </template>
  </div>
</template>
