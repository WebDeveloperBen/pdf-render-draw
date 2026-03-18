<script setup lang="ts">
import { ArrowLeft, Rocket, Ruler, PenTool, FolderOpen, CreditCard } from "lucide-vue-next"
import type { Component } from "vue"
import faqData from "@/data/faq.json"

const route = useRoute()
const categorySlug = computed(() => route.params.category as string)

const category = computed(() => faqData.categories.find((c) => c.slug === categorySlug.value))

const items = computed(() => faqData.items.filter((item) => item.category === categorySlug.value))

// 404 if category doesn't exist
if (!category.value) {
  throw createError({ statusCode: 404, statusMessage: "Category not found" })
}

useSeoMeta({ title: `${category.value.name} - Help & Support` })

const categoryIcons: Record<string, Component> = {
  rocket: Rocket,
  ruler: Ruler,
  "pen-tool": PenTool,
  "folder-open": FolderOpen,
  "credit-card": CreditCard
}
</script>

<template>
  <div v-if="category" class="space-y-8">
    <!-- Header -->
    <div>
      <UiButton variant="ghost" size="sm" class="mb-4" to="/support">
        <ArrowLeft class="mr-1 size-4" />
        All topics
      </UiButton>

      <div class="flex items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <component :is="categoryIcons[category.icon]" class="size-6 text-primary" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">{{ category.name }}</h1>
          <p class="text-muted-foreground">{{ category.description }}</p>
        </div>
      </div>
    </div>

    <!-- FAQ list -->
    <UiAccordion type="single" collapsible class="w-full space-y-2">
      <UiAccordionItem
        v-for="(item, i) in items"
        :key="`faq-${i}`"
        :value="`faq-${i}`"
        class="rounded-lg border bg-card px-4 py-1 last:border-b"
      >
        <UiAccordionTrigger class="w-full py-2 text-[15px] leading-6 hover:no-underline">
          {{ item.question }}
        </UiAccordionTrigger>
        <UiAccordionContent class="text-muted-foreground">
          {{ item.answer }}
        </UiAccordionContent>
      </UiAccordionItem>
    </UiAccordion>

    <BlocksSupportCta />
  </div>
</template>
