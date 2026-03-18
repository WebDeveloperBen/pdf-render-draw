<script setup lang="ts">
import { Building2, Calendar, Check, ChevronDown, Loader2, Mail, X } from "lucide-vue-next"
import { FREE_TIER_LIMITS, FREE_TIER_FEATURES } from "@shared/types/billing"
import type { PlanLimits, PlanFeatures } from "@shared/types/billing"

useSeoMeta({ title: "Pricing" })

const { data: plansData } = useGetApiPlans()
const { planName, isFreeTier } = useSubscription()
const { checkout, isLoading } = useCheckout()

// Free tier is defined locally (no Stripe product)
const freeTier = {
  name: "Free",
  description: "Perfect for trying out PDF annotations",
  amount: 0,
  currency: "aud",
  interval: "forever",
  limits: FREE_TIER_LIMITS,
  features: FREE_TIER_FEATURES,
  displayOrder: 0
}

// Combine free tier + API plans
const allPlans = computed(() => {
  const apiPlans = plansData.value?.plans ?? []
  return [freeTier, ...apiPlans]
})

function isCurrentPlan(plan: { name: string }) {
  const name = plan.name.toLowerCase()
  return name === planName.value || (name === "free" && isFreeTier.value)
}

function ctaLabel(plan: { name: string }) {
  const name = plan.name.toLowerCase()
  if (isCurrentPlan(plan)) return "Current Plan"
  if (name === "enterprise") return "Contact Sales"
  return `Upgrade to ${plan.name}`
}

function handleUpgrade(plan: { name: string }) {
  if (plan.name.toLowerCase() === "enterprise") {
    navigateTo("/support")
    return
  }
  checkout(plan.name)
}

function isHighlighted(plan: { name: string }) {
  return plan.name.toLowerCase() === "professional" || plan.name.toLowerCase() === "starter"
}

function formatPrice(amount: number) {
  return (amount / 100).toFixed(0)
}

function getPlanLimits(plan: { limits?: PlanLimits | null }): PlanLimits {
  return (plan.limits as PlanLimits) ?? FREE_TIER_LIMITS
}

function getPlanFeatures(plan: { features?: PlanFeatures | null }): PlanFeatures {
  return (plan.features as PlanFeatures) ?? FREE_TIER_FEATURES
}

function buildFeatureList(plan: { name: string; limits?: PlanLimits | null; features?: PlanFeatures | null }) {
  const limits = getPlanLimits(plan)
  const features = getPlanFeatures(plan)
  return [
    {
      text:
        limits.projects === -1 ? "Unlimited projects" : `${limits.projects} project${limits.projects !== 1 ? "s" : ""}`,
      included: true
    },
    { text: features.measurementTools === "all" ? "All annotation tools" : "Basic annotation tools", included: true },
    { text: `Export to ${features.exportFormats.join(", ").toUpperCase()}`, included: true },
    { text: `${limits.fileSizeMb} MB file size limit`, included: true },
    { text: "Cloud sync & backup", included: features.cloudSync },
    { text: "Measurement presets", included: features.measurementPresets },
    { text: "Team collaboration", included: features.collaboration },
    { text: "Custom branding", included: features.customBranding }
  ]
}

const faqs = [
  {
    question: "Can I upgrade at any time?",
    answer:
      "Yes! You can upgrade from Free to Starter, Professional, or Team at any time. Your existing projects and annotations will be preserved, and you'll immediately get access to all the features of your new plan."
  },
  {
    question: "How does Team seat pricing work?",
    answer:
      "The Team plan includes 3 seats for $79/month. Need more team members? Simply add additional seats for $25/month each. You can add or remove seats at any time, and billing is prorated."
  },
  {
    question: "What happens to my projects if I downgrade?",
    answer:
      "Your projects are never deleted. On the Free plan you're limited to 1 project, so you'll need to choose which project to keep active. Other projects will be archived but remain accessible if you upgrade again."
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express). For Enterprise plans with larger teams, we also offer invoice billing with NET 30 terms."
  },
  {
    question: "Can I switch between plans?",
    answer:
      "Absolutely. You can switch between Starter, Professional, and Team plans at any time. Changes take effect immediately with prorated billing."
  }
]

const openFaqIndex = ref<number | null>(null)

function toggleFaq(index: number) {
  openFaqIndex.value = openFaqIndex.value === index ? null : index
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-16">
    <!-- Header -->
    <div class="text-center">
      <UiBadge variant="secondary" class="mb-4">Pricing</UiBadge>
      <h1 class="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
      <p class="mt-4 text-lg text-muted-foreground">Start free, upgrade when you're ready. No hidden fees.</p>
    </div>

    <!-- Pricing Cards -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="plan in allPlans"
        :key="plan.name"
        :class="[
          'relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm',
          isHighlighted(plan) ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary' : 'border-border'
        ]"
      >
        <!-- Badge -->
        <UiBadge
          v-if="isHighlighted(plan)"
          variant="default"
          class="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          Most Popular
        </UiBadge>

        <!-- Header -->
        <div class="flex flex-col space-y-1.5 p-6 pb-2">
          <h3 class="text-xl font-semibold leading-none tracking-tight">{{ plan.name }}</h3>
          <p class="text-sm text-muted-foreground">{{ plan.description ?? "" }}</p>
        </div>

        <!-- Content -->
        <div class="flex-1 space-y-6 p-6 pt-0">
          <!-- Price -->
          <div>
            <div class="flex items-baseline gap-1">
              <span v-if="plan.amount === 0" class="text-4xl font-bold">Free</span>
              <template v-else>
                <span class="text-4xl font-bold">${{ formatPrice(plan.amount) }}</span>
                <span class="text-muted-foreground">/{{ plan.interval }}</span>
              </template>
            </div>
            <p v-if="plan.name.toLowerCase() === 'team'" class="mt-1 text-xs text-muted-foreground">
              Includes 3 seats, then $25/seat
            </p>
          </div>

          <!-- Features -->
          <ul class="space-y-3">
            <li v-for="feature in buildFeatureList(plan)" :key="feature.text" class="flex items-start gap-3">
              <component
                :is="feature.included ? Check : X"
                :class="['size-4 mt-0.5 shrink-0', feature.included ? 'text-primary' : 'text-muted-foreground/50']"
              />
              <span :class="['text-sm', !feature.included && 'text-muted-foreground/50']">
                {{ feature.text }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="flex items-center p-6 pt-0">
          <UiButton
            :variant="isCurrentPlan(plan) ? 'outline' : 'default'"
            :disabled="isCurrentPlan(plan) || isLoading"
            class="w-full"
            @click="handleUpgrade(plan)"
          >
            <Loader2 v-if="isLoading" class="mr-2 size-4 animate-spin" />
            {{ ctaLabel(plan) }}
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Enterprise CTA -->
    <div class="rounded-2xl border bg-linear-to-br from-muted/50 via-muted/30 to-transparent p-8 text-center md:p-12">
      <div class="mx-auto max-w-2xl space-y-4">
        <div class="flex justify-center">
          <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 class="size-6 text-primary" />
          </div>
        </div>
        <h2 class="text-2xl font-bold">Need something bigger?</h2>
        <p class="text-muted-foreground">
          For larger teams and enterprises, we offer custom solutions with dedicated support, SLA guarantees, and
          advanced security features.
        </p>
        <div class="flex flex-wrap justify-center gap-3 pt-2">
          <UiButton to="/support" variant="default">
            <Mail class="mr-2 size-4" />
            Contact Sales
          </UiButton>
          <UiButton variant="outline">
            <Calendar class="mr-2 size-4" />
            Schedule Demo
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Feature Comparison Table -->
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-2xl font-bold">Compare all features</h2>
        <p class="mt-2 text-muted-foreground">See exactly what you get with each plan</p>
      </div>

      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b bg-muted/30">
              <th class="py-4 pl-6 text-left font-medium">Feature</th>
              <th class="px-4 py-4 text-center font-medium">Free</th>
              <th class="px-4 py-4 text-center font-medium">
                <span class="inline-flex items-center gap-1.5">
                  Starter
                  <UiBadge variant="default" size="sm">Popular</UiBadge>
                </span>
              </th>
              <th class="px-4 py-4 text-center font-medium">Professional</th>
              <th class="px-4 py-4 pr-6 text-center font-medium">Team</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <!-- Pricing Row -->
            <tr class="bg-muted/10">
              <td class="py-4 pl-6 text-sm font-medium">Monthly price</td>
              <td class="px-4 py-4 text-center text-sm font-semibold">$0</td>
              <td class="px-4 py-4 text-center text-sm font-semibold text-primary">$29</td>
              <td class="px-4 py-4 text-center text-sm font-semibold">$79</td>
              <td class="px-4 py-4 pr-6 text-center text-sm font-semibold">$79</td>
            </tr>

            <!-- Section: Usage Limits -->
            <tr>
              <td
                colspan="5"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Usage Limits
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Projects</td>
              <td class="px-4 py-3 text-center text-sm">1</td>
              <td class="px-4 py-3 text-center text-sm">5</td>
              <td class="px-4 py-3 text-center text-sm font-medium text-primary">Unlimited</td>
              <td class="px-4 py-3 pr-6 text-center text-sm font-medium text-primary">Unlimited</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">File upload size</td>
              <td class="px-4 py-3 text-center text-sm">10 MB</td>
              <td class="px-4 py-3 text-center text-sm">25 MB</td>
              <td class="px-4 py-3 text-center text-sm">50 MB</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">50 MB</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Team members</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">1</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">1</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">1</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">
                3 included<br /><span class="text-xs text-muted-foreground">+$25/seat</span>
              </td>
            </tr>

            <!-- Section: Annotation Tools -->
            <tr>
              <td
                colspan="5"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Annotation Tools
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Measurement tools</td>
              <td class="px-4 py-3 text-center text-sm">Basic</td>
              <td class="px-4 py-3 text-center text-sm">Basic</td>
              <td class="px-4 py-3 text-center text-sm">All tools</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">All tools</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Measurement presets</td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Export formats</td>
              <td class="px-4 py-3 text-center text-sm">PDF</td>
              <td class="px-4 py-3 text-center text-sm">PDF</td>
              <td class="px-4 py-3 text-center text-sm">PDF, PNG, SVG</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">PDF, PNG, SVG</td>
            </tr>

            <!-- Section: Storage & Sync -->
            <tr>
              <td
                colspan="5"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Storage & Sync
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Cloud sync & backup</td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Shared project libraries</td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>

            <!-- Section: Collaboration -->
            <tr>
              <td
                colspan="5"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Collaboration
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Real-time collaboration</td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Role-based permissions</td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Custom branding</td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 text-center">
                <X class="mx-auto size-4 text-muted-foreground/50" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>

            <!-- Section: Support -->
            <tr>
              <td
                colspan="5"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Support
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Support level</td>
              <td class="px-4 py-3 text-center text-sm">Community</td>
              <td class="px-4 py-3 text-center text-sm">Email</td>
              <td class="px-4 py-3 text-center text-sm">Priority email</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">Priority email</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Response time</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">Best effort</td>
              <td class="px-4 py-3 text-center text-sm">48 hours</td>
              <td class="px-4 py-3 text-center text-sm">24 hours</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">24 hours</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- FAQs -->
    <div class="space-y-6">
      <div class="text-center">
        <h2 class="text-2xl font-bold">Frequently asked questions</h2>
        <p class="mt-2 text-muted-foreground">Everything you need to know about our pricing</p>
      </div>

      <div class="mx-auto max-w-3xl divide-y rounded-lg border">
        <div v-for="(faq, index) in faqs" :key="index" class="px-6">
          <button
            class="flex w-full items-center justify-between py-4 text-left font-medium transition-colors hover:text-primary"
            @click="toggleFaq(index)"
          >
            {{ faq.question }}
            <ChevronDown :class="['size-4 shrink-0 transition-transform', openFaqIndex === index && 'rotate-180']" />
          </button>
          <div v-show="openFaqIndex === index" class="pb-4 text-sm text-muted-foreground">
            {{ faq.answer }}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom CTA -->
    <div class="text-center">
      <p class="text-muted-foreground">
        Have questions? We're here to help.
        <NuxtLink to="/support" class="font-medium text-primary hover:underline">Contact support</NuxtLink>
      </p>
    </div>
  </div>
</template>
