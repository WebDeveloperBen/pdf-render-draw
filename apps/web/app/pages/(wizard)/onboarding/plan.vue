<script setup lang="ts">
import type { OnboardingPlanId, WizardData } from "~/types/wizard"
import { clampSeatCount, getDefaultTeamSeatCount } from "@shared/utils/billing-seats"
import { postApiUserOnboarding } from "~/models/api"
import type { PostApiUserOnboardingBody } from "~/models/api"
import { toast } from "vue-sonner"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  CreditCard,
  Crown,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Users
} from "lucide-vue-next"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))
const runtimeConfig = useRuntimeConfig()
const freeTrialPeriodInDays = runtimeConfig.public.sales.freeTrialPeriodInDays

const selectedPlan = ref<OnboardingPlanId>("professional")
const teamSeats = ref(
  clampSeatCount(wizardData.value.selectedSeats, getDefaultTeamSeatCount(wizardData.value.teamSize))
)
const isSubmitting = ref(false)

type OnboardingPlan = {
  id: OnboardingPlanId
  name: string
  price: string
  period: string
  description: string
  seats: string
  seatsNote?: string
  features: string[]
  popular: boolean
}

const plans: OnboardingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    description: "For trying the product without billing",
    seats: "1 user",
    features: ["1 project", "Basic measurements", "PDF export", "No card required"],
    popular: false
  },
  {
    id: "professional",
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For individual professionals",
    seats: "1 named user",
    features: [
      "Unlimited projects",
      "Advanced tools & annotations",
      "Cloud sync & backups",
      "Measurement presets",
      "Priority support"
    ],
    popular: true
  },
  {
    id: "team",
    name: "Team",
    price: "$79",
    period: "/seat/month",
    description: "For organisations collaborating in one workspace",
    seats: "Billed per active team member",
    features: [
      "Everything in Pro",
      "Shared organisation workspace",
      "Team collaboration",
      "Priority support",
      "Custom branding"
    ],
    popular: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organisations",
    seats: "Custom seat-based pricing",
    features: [
      "Everything in Team",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "Advanced security"
    ],
    popular: false
  }
]

const { checkout } = useCheckout()

watch(
  () => wizardData.value.teamSize,
  (teamSize) => {
    if (selectedPlan.value !== "team" || wizardData.value.selectedSeats) {
      return
    }

    teamSeats.value = getDefaultTeamSeatCount(teamSize)
  },
  { immediate: true }
)

watch(selectedPlan, (plan) => {
  if (plan !== "team") {
    return
  }

  teamSeats.value = clampSeatCount(wizardData.value.selectedSeats, getDefaultTeamSeatCount(wizardData.value.teamSize))
})

const selectedPlanConfig = computed<OnboardingPlan>(
  () => plans.find((plan) => plan.id === selectedPlan.value) ?? plans[0]!
)
const teamSeatSummary = computed(() => {
  const seatCount = clampSeatCount(teamSeats.value)
  return `${seatCount} ${seatCount === 1 ? "seat" : "seats"} selected`
})
const teamMonthlyEstimate = computed(() => clampSeatCount(teamSeats.value) * 79)

const handleComplete = async () => {
  isSubmitting.value = true

  try {
    wizardData.value.selectedPlan = selectedPlan.value
    wizardData.value.selectedSeats = selectedPlan.value === "team" ? clampSeatCount(teamSeats.value) : undefined

    // Save wizard data to backend
    const onboardingPayload: PostApiUserOnboardingBody = {
      firstName: wizardData.value.firstName,
      lastName: wizardData.value.lastName,
      companyName: wizardData.value.companyName,
      role: wizardData.value.role,
      teamSize: wizardData.value.teamSize,
      selectedPlan: wizardData.value.selectedPlan,
      selectedSeats: wizardData.value.selectedSeats
    }

    await postApiUserOnboarding(onboardingPayload)

    toast.success("Profile completed!")

    // Redirect based on plan selection
    if (selectedPlan.value === "enterprise") {
      navigateTo("/support")
    } else if (selectedPlan.value === "free") {
      navigateTo("/")
    } else {
      // Trigger real Stripe checkout
      await checkout(
        selectedPlan.value,
        selectedPlan.value === "team" ? { seats: clampSeatCount(teamSeats.value) } : undefined
      )
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
        <div class="absolute inset-0 bg-linear-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl scale-150" />
        <div
          class="relative flex items-center justify-center p-4 rounded-2xl bg-linear-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/25"
        >
          <Crown class="size-10 text-primary-foreground" />
        </div>
      </div>
      <div class="space-y-2">
        <h2
          class="text-4xl sm:text-5xl font-bold tracking-tight bg-linear-to-br from-foreground via-foreground to-foreground/70 bg-clip-text"
        >
          Choose your plan
        </h2>
        <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          Start with a {{ freeTrialPeriodInDays }}-day free trial, cancel anytime
        </p>
      </div>
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
        <Sparkles class="size-4 text-primary" />
        <span class="text-sm font-semibold text-primary">No credit card required</span>
      </div>
    </div>

    <!-- Plans Grid -->
    <div
      class="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 mt-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <div v-for="plan in plans" :key="plan.id" class="relative">
        <!-- Popular Badge (overlaps card from above) -->
        <div v-if="plan.popular" class="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <div class="relative">
            <div class="absolute inset-0 bg-primary blur-md opacity-50" />
            <UiBadge
              class="relative bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-lg border-2 border-background px-4 py-1.5 font-semibold"
            >
              <Star class="size-3 mr-1.5 fill-current" />
              Most Popular
            </UiBadge>
          </div>
        </div>

        <UiCard
          class="group relative cursor-pointer transition-all duration-300 h-full flex flex-col"
          :class="[
            selectedPlan === plan.id
              ? 'ring-2 ring-primary shadow-2xl shadow-primary/30 scale-[1.02] bg-linear-to-br from-background via-background to-primary/5'
              : 'border-2 hover:border-primary/30 hover:shadow-xl hover:scale-[1.01]',
            plan.popular ? 'border-primary/50' : ''
          ]"
          @click="selectedPlan = plan.id as any"
        >
          <!-- Background gradient -->
          <div
            v-if="selectedPlan === plan.id"
            class="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent pointer-events-none"
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
                <div v-if="selectedPlan === plan.id" class="size-3.5 rounded-full bg-primary-foreground" />
              </div>
            </div>

            <!-- Price -->
            <div class="pt-2">
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-bold bg-linear-to-br from-foreground to-foreground/80 bg-clip-text">
                  {{ plan.price }}
                </span>
                <span class="text-lg text-muted-foreground font-medium">{{ plan.period }}</span>
              </div>
              <!-- Seats info -->
              <div class="flex items-center gap-2 mt-2">
                <span class="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users class="size-3.5" />
                  {{ plan.seats }}
                </span>
                <span v-if="plan.seatsNote" class="text-xs text-muted-foreground/70">
                  {{ plan.seatsNote }}
                </span>
              </div>
            </div>
          </UiCardHeader>

          <UiCardContent class="relative flex flex-col flex-1">
            <!-- Features -->
            <ul class="space-y-3 flex-1">
              <li v-for="feature in plan.features" :key="feature" class="flex items-start gap-3 text-sm group/feature">
                <div
                  class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5 group-hover/feature:bg-primary/20 transition-colors"
                >
                  <Check class="size-3.5 text-primary" />
                </div>
                <span class="leading-relaxed font-medium">{{ feature }}</span>
              </li>
            </ul>

            <!-- CTA Button in card -->
            <div class="pt-6 mt-auto">
              <UiButton
                :variant="selectedPlan === plan.id ? 'default' : 'outline'"
                class="w-full h-11 font-semibold transition-all"
                :class="
                  selectedPlan === plan.id
                    ? 'bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/30'
                    : 'hover:border-primary/50'
                "
                @click.stop="selectedPlan = plan.id as any"
              >
                <template v-if="selectedPlan === plan.id">
                  <CheckCircle class="size-4 mr-2" />
                  Selected
                </template>
                <template v-else> Select {{ plan.name }} </template>
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
    </div>

    <UiCard
      v-if="selectedPlan === 'team'"
      class="border-2 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-linear-to-br from-background via-background to-primary/5"
    >
      <UiCardContent class="p-6 sm:p-8">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div class="space-y-2">
            <p class="text-sm font-semibold text-primary flex items-center gap-2">
              <Users class="size-4" />
              Team seats
            </p>
            <h3 class="text-xl font-semibold">Choose how many people need access</h3>
            <p class="max-w-2xl text-sm text-muted-foreground">
              Team is billed per active seat. We’ve prefilled this from your company size, and you can change it now
              before heading to Stripe.
            </p>
          </div>

          <div class="w-full max-w-sm space-y-3">
            <UiNumberField v-model="teamSeats" :min="1" :step="1">
              <UiNumberFieldDecrement />
              <UiNumberFieldInput class="text-center font-semibold" />
              <UiNumberFieldIncrement />
            </UiNumberField>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">{{ teamSeatSummary }}</span>
              <span class="font-medium">${{ teamMonthlyEstimate }}/month</span>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Summary Card -->
    <UiCard class="border-2 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
      <UiCardContent class="p-6 sm:p-8">
        <!-- Header section -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div class="space-y-1">
            <p class="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle class="size-4 text-primary" />
              You've selected
            </p>
            <p class="text-2xl sm:text-3xl font-bold">{{ selectedPlanConfig.name }} Plan</p>
            <p class="text-sm text-muted-foreground flex items-center gap-2">
              <Users class="size-4" />
              {{ selectedPlan === "team" ? teamSeatSummary : selectedPlanConfig.seats }}
              <span v-if="selectedPlanConfig.seatsNote" class="text-muted-foreground/70">
                ({{ selectedPlanConfig.seatsNote }})
              </span>
            </p>
          </div>

          <div class="flex flex-col items-start sm:items-end gap-0.5">
            <p class="text-sm font-medium text-muted-foreground">
              {{ selectedPlan === "enterprise" ? "Pricing" : selectedPlan === "team" ? "Billing" : "Starting at" }}
            </p>
            <div class="flex items-baseline gap-2">
              <span class="text-4xl font-bold">
                {{ selectedPlan === "team" ? `$${teamMonthlyEstimate}` : selectedPlanConfig.price }}
              </span>
              <span v-if="selectedPlanConfig.period" class="text-base font-medium text-muted-foreground">
                {{ selectedPlanConfig.period }}
              </span>
            </div>
          </div>
        </div>

        <div class="h-px bg-border my-6" />

        <!-- Benefits row -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
          <div class="flex items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm font-semibold">{{ freeTrialPeriodInDays }}-day free trial</p>
              <p class="text-xs text-muted-foreground">Full access, no limits</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm font-semibold">No card required</p>
              <p class="text-xs text-muted-foreground">Start immediately</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <RotateCcw class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm font-semibold">Cancel anytime</p>
              <p class="text-xs text-muted-foreground">No commitments</p>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Actions -->
    <div
      class="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500"
    >
      <UiButton
        variant="outline"
        size="lg"
        class="group h-12 px-6 text-base border-2 hover:bg-accent"
        :disabled="isSubmitting"
        @click="handleBack"
      >
        <ArrowLeft class="size-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        <span class="font-medium">Back</span>
      </UiButton>
      <UiButton
        size="lg"
        class="h-14 px-12 text-base shadow-2xl shadow-primary/30 bg-gradient-to-r from-primary via-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/40 transition-all hover:scale-[1.03] active:scale-[0.98] group relative overflow-hidden"
        :disabled="isSubmitting"
        @click="handleComplete"
      >
        <div
          v-if="!isSubmitting"
          class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
        />
        <UiSpinner v-if="isSubmitting" class="size-5 mr-2" />
        <template v-else>
          <span class="font-bold text-lg">
            {{
              selectedPlan === "enterprise"
                ? "Contact Sales"
                : selectedPlan === "free"
                  ? "Continue on Free"
                  : "Start Free Trial"
            }}
          </span>
          <ArrowRight class="size-6 ml-3 group-hover:translate-x-1 transition-transform" />
        </template>
      </UiButton>
    </div>
  </div>
</template>
