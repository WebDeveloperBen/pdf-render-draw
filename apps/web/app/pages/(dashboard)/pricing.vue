<script setup lang="ts">
import { Building2, Calendar, Check, ChevronDown, Mail, X } from "lucide-vue-next"
useSeoMeta({ title: "Pricing" })

interface PricingFeature {
  text: string
  included: boolean
  tooltip?: string
}

interface PricingTier {
  name: string
  description: string
  price: number | null
  priceLabel?: string
  interval: string
  subtext?: string
  badge?: string
  highlighted?: boolean
  features: PricingFeature[]
  cta: string
  ctaVariant: "default" | "outline" | "secondary"
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    description: "Perfect for trying out PDF annotations",
    price: 0,
    interval: "forever",
    features: [
      { text: "1 project", included: true },
      { text: "Basic annotation tools", included: true },
      { text: "Export to PDF", included: true },
      { text: "25 MB file size limit", included: true },
      { text: "Community support", included: true },
      { text: "Cloud sync", included: false },
      { text: "Team collaboration", included: false },
      { text: "Priority support", included: false }
    ],
    cta: "Current Plan",
    ctaVariant: "outline"
  },
  {
    name: "Pro",
    description: "For professionals who need more power",
    price: 29,
    interval: "month",
    badge: "Most Popular",
    highlighted: true,
    features: [
      { text: "Unlimited projects", included: true },
      { text: "All annotation tools", included: true },
      { text: "Export to PDF, PNG, SVG", included: true },
      { text: "50 MB file size limit", included: true },
      { text: "Cloud sync & backup", included: true },
      { text: "Email support", included: true },
      { text: "Measurement presets", included: true },
      { text: "Priority support", included: true }
    ],
    cta: "Upgrade to Pro",
    ctaVariant: "default"
  },
  {
    name: "Team",
    description: "Collaborate with your entire crew",
    price: 79,
    interval: "month",
    subtext: "Includes 3 seats, then $10/seat",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "3 team members included", included: true },
      { text: "$10/month per additional seat", included: true },
      { text: "Real-time collaboration", included: true },
      { text: "Shared project libraries", included: true },
      { text: "Role-based permissions", included: true },
      { text: "Priority support", included: true },
      { text: "Custom branding", included: true }
    ],
    cta: "Get Team",
    ctaVariant: "secondary"
  }
]

const faqs = [
  {
    question: "Can I upgrade from Free to Pro at any time?",
    answer:
      "Yes! You can upgrade from Free to Pro or Team at any time. Your existing project and annotations will be preserved, and you'll immediately get access to all the features of your new plan."
  },
  {
    question: "How does Team seat pricing work?",
    answer:
      "The Team plan includes 3 seats for $79/month. Need more team members? Simply add additional seats for $10/month each. You can add or remove seats at any time, and billing is prorated."
  },
  {
    question: "What happens to my project if I downgrade from Pro to Free?",
    answer:
      "Your project is never deleted. On the Free plan you're limited to 1 project, so you'll need to choose which project to keep active. Other projects will be archived but remain accessible if you upgrade again."
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express). For Enterprise plans with larger teams, we also offer invoice billing with NET 30 terms."
  },
  {
    question: "Can I switch between Pro and Team plans?",
    answer:
      "Absolutely. If you're on Pro and need collaboration features, upgrading to Team is seamless. If you're on Team but working solo, you can downgrade to Pro. Changes take effect immediately with prorated billing."
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
    <div class="grid gap-6 md:grid-cols-3">
      <div
        v-for="tier in tiers"
        :key="tier.name"
        :class="[
          'relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm',
          tier.highlighted ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary' : 'border-border'
        ]"
      >
        <!-- Badge -->
        <UiBadge
          v-if="tier.badge"
          variant="default"
          class="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap"
        >
          {{ tier.badge }}
        </UiBadge>

        <!-- Header -->
        <div class="flex flex-col space-y-1.5 p-6 pb-2">
          <h3 class="text-xl font-semibold leading-none tracking-tight">{{ tier.name }}</h3>
          <p class="text-sm text-muted-foreground">{{ tier.description }}</p>
        </div>

        <!-- Content -->
        <div class="flex-1 space-y-6 p-6 pt-0">
          <!-- Price -->
          <div>
            <div class="flex items-baseline gap-1">
              <span v-if="tier.price === 0" class="text-4xl font-bold">Free</span>
              <template v-else-if="tier.price">
                <span class="text-4xl font-bold">${{ tier.price }}</span>
                <span class="text-muted-foreground">/{{ tier.interval }}</span>
              </template>
              <span v-else class="text-4xl font-bold">{{ tier.priceLabel }}</span>
            </div>
            <p v-if="tier.subtext" class="mt-1 text-xs text-muted-foreground">
              {{ tier.subtext }}
            </p>
          </div>

          <!-- Features -->
          <ul class="space-y-3">
            <li v-for="feature in tier.features" :key="feature.text" class="flex items-start gap-3">
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
          <!-- Free tier - disabled current plan -->
          <UiButton v-if="tier.name === 'Free'" :variant="tier.ctaVariant" class="w-full" disabled>
            {{ tier.cta }}
          </UiButton>
          <!-- Pro/Team tiers - coming soon with tooltip -->
          <UiTooltip v-else>
            <UiTooltipTrigger as-child>
              <!-- Wrapper span needed because disabled buttons don't receive pointer events -->
              <span class="inline-block w-full">
                <UiButton :variant="tier.ctaVariant" class="w-full pointer-events-none" disabled>
                  {{ tier.cta }}
                </UiButton>
              </span>
            </UiTooltipTrigger>
            <UiTooltipContent>
              <p>Coming soon</p>
            </UiTooltipContent>
          </UiTooltip>
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
                  Pro
                  <UiBadge variant="default" size="sm">Popular</UiBadge>
                </span>
              </th>
              <th class="px-4 py-4 pr-6 text-center font-medium">Team</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <!-- Pricing Row -->
            <tr class="bg-muted/10">
              <td class="py-4 pl-6 text-sm font-medium">Monthly price</td>
              <td class="px-4 py-4 text-center text-sm font-semibold">$0</td>
              <td class="px-4 py-4 text-center text-sm font-semibold text-primary">$29</td>
              <td class="px-4 py-4 pr-6 text-center text-sm font-semibold">$79</td>
            </tr>

            <!-- Section: Usage Limits -->
            <tr>
              <td
                colspan="4"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Usage Limits
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Projects</td>
              <td class="px-4 py-3 text-center text-sm">1</td>
              <td class="px-4 py-3 text-center text-sm font-medium text-primary">Unlimited</td>
              <td class="px-4 py-3 pr-6 text-center text-sm font-medium text-primary">Unlimited</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">File upload size</td>
              <td class="px-4 py-3 text-center text-sm">25 MB</td>
              <td class="px-4 py-3 text-center text-sm">50 MB</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">50 MB</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Team members</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">1</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">1</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">
                3 included<br /><span class="text-xs text-muted-foreground">+$10/seat</span>
              </td>
            </tr>

            <!-- Section: Annotation Tools -->
            <tr>
              <td
                colspan="4"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Annotation Tools
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Measurement tools</td>
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
                <Check class="mx-auto size-4 text-primary" />
              </td>
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Export formats</td>
              <td class="px-4 py-3 text-center text-sm">PDF</td>
              <td class="px-4 py-3 text-center text-sm">PDF, PNG, SVG</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">PDF, PNG, SVG</td>
            </tr>

            <!-- Section: Storage & Sync -->
            <tr>
              <td
                colspan="4"
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
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>

            <!-- Section: Collaboration -->
            <tr>
              <td
                colspan="4"
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
              <td class="px-4 py-3 pr-6 text-center">
                <Check class="mx-auto size-4 text-primary" />
              </td>
            </tr>

            <!-- Section: Support -->
            <tr>
              <td
                colspan="4"
                class="bg-muted/20 py-2 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Support
              </td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Support level</td>
              <td class="px-4 py-3 text-center text-sm">Community</td>
              <td class="px-4 py-3 text-center text-sm">Priority email</td>
              <td class="px-4 py-3 pr-6 text-center text-sm">Priority email</td>
            </tr>
            <tr>
              <td class="py-3 pl-6 text-sm">Response time</td>
              <td class="px-4 py-3 text-center text-sm text-muted-foreground">Best effort</td>
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
            <ChevronDown
              :class="['size-4 shrink-0 transition-transform', openFaqIndex === index && 'rotate-180']" />
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
