<script setup lang="ts">
import type { WizardData } from "~/types/wizard"
import { toast } from "vue-sonner"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))
const session = authClient.useSession()

const selectedPlan = ref<"starter" | "professional" | "enterprise">("professional")
const isSubmitting = ref(false)

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for individual contractors",
    features: ["5 projects per month", "Basic measurements", "PDF export", "Email support"],
    popular: false
  },
  {
    id: "professional",
    name: "Professional",
    price: "$79",
    period: "/month",
    description: "For growing teams",
    features: [
      "Unlimited projects",
      "Advanced tools & annotations",
      "Team collaboration",
      "Priority support",
      "Custom branding"
    ],
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: [
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "Advanced security"
    ],
    popular: false
  }
]

const handleComplete = async () => {
  isSubmitting.value = true

  try {
    wizardData.value.selectedPlan = selectedPlan.value

    // Save wizard data to backend
    await $fetch("/api/user/onboarding", {
      method: "POST",
      body: wizardData.value
    })

    toast.success("Profile completed!")

    // Redirect based on plan selection
    if (selectedPlan.value === "enterprise") {
      // For enterprise, redirect to contact sales
      navigateTo("/contact-sales")
    } else {
      // For paid plans, redirect to Stripe checkout
      // In production, you'd create a Stripe checkout session here
      navigateTo("/checkout?plan=" + selectedPlan.value)
    }
  } catch (error: any) {
    toast.error(error.data?.statusMessage || "Failed to complete onboarding")
  } finally {
    isSubmitting.value = false
  }
}

const handleBack = () => {
  navigateTo("/onboarding/usecase")
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div class="relative inline-flex items-center justify-center">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl scale-150" />
        <div class="relative flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/25">
          <Icon name="lucide:crown" class="size-10 text-primary-foreground" />
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text">
          Choose your plan
        </h2>
        <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          Start with a 14-day free trial, cancel anytime
        </p>
      </div>
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
        <Icon name="lucide:sparkles" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-primary">No credit card required</span>
      </div>
    </div>

    <!-- Plans Grid -->
    <div class="grid md:grid-cols-3 gap-5 lg:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
      <UiCard
        v-for="plan in plans"
        :key="plan.id"
        class="group relative cursor-pointer transition-all duration-300 overflow-hidden"
        :class="[
          selectedPlan === plan.id
            ? 'ring-2 ring-primary shadow-2xl shadow-primary/30 scale-[1.02] bg-gradient-to-br from-background via-background to-primary/5'
            : 'border-2 hover:border-primary/30 hover:shadow-xl hover:scale-[1.01]',
          plan.popular ? 'border-primary/50' : ''
        ]"
        @click="selectedPlan = plan.id as any"
      >
        <!-- Popular Badge -->
        <div v-if="plan.popular" class="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div class="relative">
            <div class="absolute inset-0 bg-primary blur-md" />
            <UiBadge class="relative bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-lg border-2 border-background px-4 py-1 font-semibold">
              <Icon name="lucide:star" class="size-3 mr-1 fill-current" />
              Most Popular
            </UiBadge>
          </div>
        </div>

        <!-- Background gradient -->
        <div
          v-if="selectedPlan === plan.id"
          class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none"
        />

        <UiCardHeader class="relative pb-4">
          <div class="flex items-start justify-between mb-2">
            <div class="space-y-1">
              <UiCardTitle class="text-2xl font-bold">{{ plan.name }}</UiCardTitle>
              <UiCardDescription class="text-base">{{ plan.description }}</UiCardDescription>
            </div>
            <div
              class="flex size-7 items-center justify-center rounded-full border-2 shrink-0 transition-all duration-300"
              :class="
                selectedPlan === plan.id
                  ? 'border-primary bg-primary shadow-lg shadow-primary/30 scale-110'
                  : 'border-muted-foreground group-hover:border-primary/50 group-hover:scale-105'
              "
            >
              <div
                v-if="selectedPlan === plan.id"
                class="size-3.5 rounded-full bg-primary-foreground"
              />
            </div>
          </div>

          <!-- Price -->
          <div class="flex items-baseline gap-2 pt-2">
            <span class="text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/80 bg-clip-text">
              {{ plan.price }}
            </span>
            <span class="text-lg text-muted-foreground font-medium">{{ plan.period }}</span>
          </div>
        </UiCardHeader>

        <UiCardContent class="relative space-y-5">
          <!-- Features -->
          <ul class="space-y-3.5">
            <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-3 text-sm group/feature">
              <div class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5 group-hover/feature:bg-primary/20 transition-colors">
                <Icon name="lucide:check" class="size-3.5 text-primary" />
              </div>
              <span class="leading-relaxed font-medium">{{ feature }}</span>
            </li>
          </ul>

          <!-- CTA Button in card -->
          <div class="pt-4">
            <UiButton
              :variant="selectedPlan === plan.id ? 'default' : 'outline'"
              class="w-full h-11 font-semibold transition-all"
              :class="selectedPlan === plan.id ? 'bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/30' : 'hover:border-primary/50'"
              @click.stop="selectedPlan = plan.id as any"
            >
              <template v-if="selectedPlan === plan.id">
                <Icon name="lucide:check-circle" class="size-4 mr-2" />
                Selected
              </template>
              <template v-else>
                Select {{ plan.name }}
              </template>
            </UiButton>
          </div>
        </UiCardContent>

        <!-- Selected indicator border glow -->
        <div
          v-if="selectedPlan === plan.id"
          class="absolute inset-0 rounded-lg ring-1 ring-inset ring-primary/20 pointer-events-none"
        />
      </UiCard>
    </div>

    <!-- Summary Card -->
    <UiCard class="border-2 shadow-xl bg-gradient-to-br from-muted/30 via-muted/20 to-background overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
      <div class="absolute top-0 right-0 size-64 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <UiCardContent class="relative p-6 sm:p-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div class="space-y-2">
            <p class="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Icon name="lucide:package" class="size-4" />
              You've selected
            </p>
            <p class="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              {{ plans.find((p) => p.id === selectedPlan)?.name }} Plan
            </p>
          </div>
          <div class="flex flex-col items-start sm:items-end gap-1">
            <p class="text-sm font-medium text-muted-foreground">Starting at</p>
            <div class="flex items-baseline gap-2">
              <span class="text-4xl font-bold bg-gradient-to-br from-primary to-primary/80 bg-clip-text">
                {{ plans.find((p) => p.id === selectedPlan)?.price }}
              </span>
              <span class="text-base font-medium text-muted-foreground">
                {{ plans.find((p) => p.id === selectedPlan)?.period }}
              </span>
            </div>
          </div>
        </div>

        <div class="h-px bg-gradient-to-r from-transparent via-border to-transparent my-6" />

        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
          <div class="flex items-center gap-3 text-sm">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon name="lucide:shield-check" class="size-5 text-primary" />
            </div>
            <div class="space-y-0.5">
              <p class="font-semibold">14-day free trial</p>
              <p class="text-xs text-muted-foreground">Full access, no limits</p>
            </div>
          </div>

          <div class="flex items-center gap-3 text-sm">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon name="lucide:credit-card" class="size-5 text-primary" />
            </div>
            <div class="space-y-0.5">
              <p class="font-semibold">No card required</p>
              <p class="text-xs text-muted-foreground">Start immediately</p>
            </div>
          </div>

          <div class="flex items-center gap-3 text-sm">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon name="lucide:rotate-ccw" class="size-5 text-primary" />
            </div>
            <div class="space-y-0.5">
              <p class="font-semibold">Cancel anytime</p>
              <p class="text-xs text-muted-foreground">No commitments</p>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Actions -->
    <div class="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
      <UiButton variant="outline" size="lg" class="group h-12 px-6 text-base border-2 hover:bg-accent" :disabled="isSubmitting" @click="handleBack">
        <Icon name="lucide:arrow-left" class="size-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        <span class="font-medium">Back</span>
      </UiButton>
      <UiButton
        size="lg"
        class="h-14 px-12 text-base shadow-2xl shadow-primary/30 bg-gradient-to-r from-primary via-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/40 transition-all hover:scale-[1.03] active:scale-[0.98] group relative overflow-hidden"
        :disabled="isSubmitting"
        @click="handleComplete"
      >
        <div v-if="!isSubmitting" class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        <Icon v-if="isSubmitting" name="svg-spinners:90-ring-with-bg" class="size-5 mr-2" />
        <template v-else>
          <span class="font-bold text-lg">
            {{ selectedPlan === "enterprise" ? "Contact Sales" : "Start Free Trial" }}
          </span>
          <Icon name="lucide:arrow-right" class="size-6 ml-3 group-hover:translate-x-1 transition-transform" />
        </template>
      </UiButton>
    </div>
  </div>
</template>
