<script setup lang="ts">
import type { WizardData } from "~/types/wizard"
import { toast } from "vue-sonner"
import { ArrowLeft, ArrowRight, Calculator, Check, ClipboardCheck, FileText, Layers, Megaphone, Ruler, Target, Users } from "lucide-vue-next"
import type { Component } from "vue"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))

const selectedUseCases = ref<string[]>(wizardData.value.useCases || [])
const referralSource = ref(wizardData.value.referralSource || "")

const useCases: Array<{ value: string; label: string; icon: Component }> = [
  { value: "measure", label: "Measure plans", icon: Ruler },
  { value: "estimates", label: "Estimates & quotes", icon: Calculator },
  { value: "documentation", label: "Documentation", icon: FileText },
  { value: "collaboration", label: "Collaboration", icon: Users },
  { value: "inspections", label: "Inspections", icon: ClipboardCheck }
]

const referralSources = [
  { value: "search", label: "Search" },
  { value: "social", label: "Social media" },
  { value: "referral", label: "Friend or colleague" },
  { value: "ad", label: "Advertisement" },
  { value: "other", label: "Other" }
]

const toggleUseCase = (value: string) => {
  const index = selectedUseCases.value.indexOf(value)
  if (index > -1) {
    selectedUseCases.value.splice(index, 1)
  } else {
    selectedUseCases.value.push(value)
  }
}

const handleNext = () => {
  if (selectedUseCases.value.length === 0) {
    toast.error("Please select at least one use case")
    return
  }

  wizardData.value.useCases = selectedUseCases.value
  wizardData.value.referralSource = referralSource.value || undefined
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
        <div class="absolute inset-0 bg-linear-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl scale-150" />
        <div
          class="relative flex items-center justify-center p-4 rounded-2xl bg-linear-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/25"
        >
          <Target class="size-10 text-primary-foreground" />
        </div>
      </div>
      <div class="space-y-2">
        <h2
          class="text-4xl sm:text-5xl font-bold tracking-tight bg-linear-to-br from-foreground via-foreground to-foreground/70 bg-clip-text"
        >
          Almost there!
        </h2>
        <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">Just a couple of quick questions</p>
      </div>
    </div>

    <!-- Form Card -->
    <UiCard
      class="border-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 overflow-hidden bg-linear-to-br from-background via-background to-muted/5"
    >
      <UiCardContent class="p-6 sm:p-10 space-y-10">
        <!-- Use Cases -->
        <div class="space-y-4">
          <div>
            <UiLabel class="text-base font-semibold justify-start">
              <Layers class="size-4 text-primary" />
              What will you use this app for?
              <span class="text-destructive">*</span>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">Select all that apply</p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              v-for="usecase in useCases"
              :key="usecase.value"
              type="button"
              class="group relative flex flex-col items-center gap-3 p-4 border-2 rounded-xl transition-all hover:border-primary/40 hover:bg-primary/5"
              :class="selectedUseCases.includes(usecase.value) ? 'border-primary bg-primary/5' : 'border-border'"
              @click="toggleUseCase(usecase.value)"
            >
              <div
                class="flex size-12 items-center justify-center rounded-lg transition-all"
                :class="
                  selectedUseCases.includes(usecase.value)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                "
              >
                <component :is="usecase.icon" class="size-6" />
              </div>
              <span class="font-medium text-sm text-center">{{ usecase.label }}</span>

              <!-- Check indicator -->
              <div
                v-if="selectedUseCases.includes(usecase.value)"
                class="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary border-2 border-background"
              >
                <Check class="size-3.5 text-primary-foreground" />
              </div>
            </button>
          </div>
        </div>

        <!-- Referral Source -->
        <div class="space-y-4">
          <div>
            <UiLabel class="text-base font-semibold">
              <Megaphone class="size-4 text-primary" />
              How did you hear about us?
              <UiBadge variant="secondary" class="ml-auto text-xs font-normal">Optional</UiBadge>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">Helps us reach more people like you</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="source in referralSources"
              :key="source.value"
              type="button"
              class="px-4 py-2.5 border-2 rounded-full transition-all text-sm font-medium"
              :class="
                referralSource === source.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
              "
              @click="referralSource = source.value"
            >
              {{ source.label }}
            </button>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Actions -->
    <div
      class="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300"
    >
      <UiButton
        variant="outline"
        size="lg"
        class="group h-12 px-6 text-base border-2 hover:bg-accent"
        @click="handleBack"
      >
        <ArrowLeft class="size-5 mr-2 group-hover:-translate-x-1 transition-transform" />
        <span class="font-medium">Back</span>
      </UiButton>
      <UiButton
        size="lg"
        class="h-12 px-10 text-base shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        :disabled="selectedUseCases.length === 0"
        @click="handleNext"
      >
        <span class="font-semibold">Continue</span>
        <ArrowRight class="size-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </UiButton>
    </div>
  </div>
</template>
