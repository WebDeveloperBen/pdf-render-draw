<script setup lang="ts">
import type { WizardData } from "~/types/wizard"
import { toast } from "vue-sonner"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))

const industry = ref(wizardData.value.industry || "")
const primaryUseCase = ref(wizardData.value.primaryUseCase || "")
const goals = ref<string[]>(wizardData.value.goals || [])

const industries = [
  { value: "construction", label: "Construction", icon: "lucide:building" },
  { value: "architecture", label: "Architecture", icon: "lucide:ruler" },
  { value: "engineering", label: "Engineering", icon: "lucide:cog" },
  { value: "real-estate", label: "Real Estate", icon: "lucide:home" },
  { value: "facilities", label: "Facilities Management", icon: "lucide:warehouse" },
  { value: "other", label: "Other", icon: "lucide:more-horizontal" }
]

const useCases = [
  "Measure building plans",
  "Create estimates & quotes",
  "Project documentation",
  "Client collaboration",
  "Team coordination",
  "Quality control & inspections"
]

const availableGoals = [
  "Reduce measurement time",
  "Improve accuracy",
  "Better client communication",
  "Streamline workflows",
  "Scale my business",
  "Go paperless"
]

const toggleGoal = (goal: string) => {
  const index = goals.value.indexOf(goal)
  if (index > -1) {
    goals.value.splice(index, 1)
  } else {
    goals.value.push(goal)
  }
}

const handleNext = () => {
  if (!industry.value) {
    toast.error("Please select your industry")
    return
  }

  if (!primaryUseCase.value) {
    toast.error("Please select your primary use case")
    return
  }

  wizardData.value.industry = industry.value
  wizardData.value.primaryUseCase = primaryUseCase.value
  wizardData.value.goals = goals.value

  navigateTo("/onboarding/plan")
}

const handleBack = () => {
  navigateTo("/onboarding/company")
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div class="relative inline-flex items-center justify-center">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl scale-150" />
        <div class="relative flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/25">
          <Icon name="lucide:target" class="size-10 text-primary-foreground" />
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text">
          How will you use MetreMate?
        </h2>
        <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          Help us understand your workflow
        </p>
      </div>
    </div>

    <!-- Form Card -->
    <UiCard class="border-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 overflow-hidden bg-gradient-to-br from-background via-background to-muted/5">
      <UiCardContent class="p-6 sm:p-10 space-y-10">
        <!-- Industry -->
        <div class="space-y-5">
          <div>
            <UiLabel class="text-base font-semibold flex items-center gap-2">
              <Icon name="lucide:briefcase" class="size-4 text-primary" />
              What industry are you in?
              <span class="text-destructive ml-1">*</span>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              We'll show you relevant features
            </p>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <button
              v-for="ind in industries"
              :key="ind.value"
              type="button"
              class="group relative flex flex-col items-center gap-3 p-5 border-2 rounded-2xl transition-all hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg"
              :class="industry === ind.value ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-xl shadow-primary/20 scale-[1.02]' : 'border-border'"
              @click="industry = ind.value"
            >
              <div
                class="flex size-14 items-center justify-center rounded-xl transition-all duration-300 shadow-sm"
                :class="
                  industry === ind.value
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-muted text-muted-foreground group-hover:bg-gradient-to-br group-hover:from-primary/20 group-hover:to-primary/10 group-hover:text-primary'
                "
              >
                <Icon :name="ind.icon" class="size-7" />
              </div>
              <span class="font-semibold text-sm text-center leading-tight">{{ ind.label }}</span>

              <!-- Check indicator -->
              <div
                v-if="industry === ind.value"
                class="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary shadow-lg border-4 border-background"
              >
                <Icon name="lucide:check" class="size-4 text-primary-foreground" />
              </div>
            </button>
          </div>
        </div>

        <!-- Primary Use Case -->
        <div class="space-y-5">
          <div>
            <UiLabel class="text-base font-semibold flex items-center gap-2">
              <Icon name="lucide:zap" class="size-4 text-primary" />
              Primary use case?
              <span class="text-destructive ml-1">*</span>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              What's your main focus?
            </p>
          </div>
          <div class="space-y-3">
            <button
              v-for="usecase in useCases"
              :key="usecase"
              type="button"
              class="group w-full flex items-center gap-4 p-4 sm:p-5 border-2 rounded-xl transition-all hover:border-primary/40 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent hover:shadow-md text-left"
              :class="primaryUseCase === usecase ? 'border-primary bg-gradient-to-r from-primary/10 to-transparent shadow-lg shadow-primary/10' : 'border-border'"
              @click="primaryUseCase = usecase"
            >
              <div
                class="flex size-6 items-center justify-center rounded-full border-2 shrink-0 transition-all duration-300"
                :class="primaryUseCase === usecase ? 'border-primary bg-primary scale-110 shadow-md shadow-primary/30' : 'border-muted-foreground group-hover:border-primary/50'"
              >
                <div v-if="primaryUseCase === usecase" class="size-2.5 rounded-full bg-primary-foreground" />
              </div>
              <span class="font-semibold text-base">{{ usecase }}</span>
            </button>
          </div>
        </div>

        <!-- Goals (Optional) -->
        <div class="space-y-5">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
              <Icon name="lucide:sparkles" class="size-3.5 text-primary" />
              <span class="text-sm font-semibold text-muted-foreground">Optional</span>
            </div>
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div>
            <UiLabel class="text-base font-semibold flex items-center gap-2">
              <Icon name="lucide:trophy" class="size-4 text-primary" />
              What are your goals?
              <UiBadge variant="secondary" class="ml-auto text-xs font-normal">Select multiple</UiBadge>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              We'll personalize your dashboard
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-for="goal in availableGoals"
              :key="goal"
              type="button"
              class="group relative flex items-center gap-3 p-4 border-2 rounded-xl transition-all hover:border-primary/40 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent text-left hover:shadow-md"
              :class="goals.includes(goal) ? 'border-primary bg-gradient-to-r from-primary/10 to-transparent shadow-md shadow-primary/10' : 'border-border'"
              @click="toggleGoal(goal)"
            >
              <div
                class="flex size-6 items-center justify-center rounded-lg border-2 shrink-0 transition-all duration-300"
                :class="goals.includes(goal) ? 'border-primary bg-primary shadow-md shadow-primary/30' : 'border-muted-foreground group-hover:border-primary/50'"
              >
                <Icon v-if="goals.includes(goal)" name="lucide:check" class="size-4 text-primary-foreground" />
              </div>
              <span class="text-sm font-semibold">{{ goal }}</span>
            </button>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Actions -->
    <div class="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
      <UiButton variant="outline" size="lg" class="group h-12 px-6 text-base border-2 hover:bg-accent" @click="handleBack">
        <Icon name="lucide:arrow-left" class="size-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        <span class="font-medium">Back</span>
      </UiButton>
      <UiButton size="lg" class="h-12 px-10 text-base shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" :disabled="!industry || !primaryUseCase" @click="handleNext">
        <span class="font-semibold">Continue</span>
        <Icon name="lucide:arrow-right" class="size-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </UiButton>
    </div>
  </div>
</template>
