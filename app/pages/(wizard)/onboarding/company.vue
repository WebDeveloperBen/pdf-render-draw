<script setup lang="ts">
import type { WizardData } from "~/types/wizard"
import { toast } from "vue-sonner"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))

const companyName = ref(wizardData.value.companyName || "")
const role = ref(wizardData.value.role || "")
const teamSize = ref(wizardData.value.teamSize || "")

const roles = [
  { value: "contractor", label: "Contractor", icon: "lucide:hard-hat" },
  { value: "pm", label: "Project Manager", icon: "lucide:clipboard-list" },
  { value: "architect", label: "Architect", icon: "lucide:ruler-square" },
  { value: "engineer", label: "Engineer", icon: "lucide:cog" },
  { value: "estimator", label: "Estimator", icon: "lucide:calculator" },
  { value: "owner", label: "Business Owner", icon: "lucide:briefcase" },
  { value: "other", label: "Other", icon: "lucide:more-horizontal" }
]

const teamSizes = [
  { value: "solo", label: "Just me", icon: "lucide:user" },
  { value: "small", label: "2-10", icon: "lucide:users" },
  { value: "medium", label: "11-50", icon: "lucide:users-round" },
  { value: "large", label: "51-200", icon: "lucide:building" },
  { value: "enterprise", label: "200+", icon: "lucide:building-2" }
]

const handleNext = () => {
  if (!role.value) {
    toast.error("Please select your role")
    return
  }

  if (!teamSize.value) {
    toast.error("Please select your team size")
    return
  }

  wizardData.value.companyName = companyName.value
  wizardData.value.role = role.value
  wizardData.value.teamSize = teamSize.value

  navigateTo("/onboarding/usecase")
}

const handleBack = () => {
  navigateTo("/onboarding/personal")
}
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div class="relative inline-flex items-center justify-center">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl blur-2xl scale-150" />
        <div class="relative flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/90 shadow-lg shadow-primary/25">
          <Icon name="lucide:building" class="size-10 text-primary-foreground" />
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text">
          Your workspace
        </h2>
        <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          Help us tailor MetreMate to your workflow
        </p>
      </div>
    </div>

    <!-- Main Card -->
    <UiCard class="border-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 overflow-hidden bg-gradient-to-br from-background via-background to-muted/5">
      <UiCardContent class="p-6 sm:p-10 space-y-10">
        <!-- Company Name -->
        <div class="space-y-4">
          <div>
            <UiLabel for="company" class="text-base font-semibold flex items-center gap-2">
              <Icon name="lucide:briefcase" class="size-4 text-primary" />
              Company Name
              <UiBadge variant="secondary" class="ml-auto text-xs font-normal">Optional</UiBadge>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1.5">
              Personalize your workspace and branding
            </p>
          </div>
          <div class="relative group/input">
            <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
              <Icon name="lucide:building-2" class="size-5 text-muted-foreground group-focus-within/input:text-primary transition-all duration-300" />
            </div>
            <UiInput
              id="company"
              v-model="companyName"
              placeholder="Acme Construction Co."
              class="pl-14 h-14 text-base border-2 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all shadow-sm hover:shadow-md hover:border-primary/50"
            />
          </div>
        </div>

        <!-- Role Selection -->
        <div class="space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <UiLabel class="text-base font-semibold flex items-center gap-2">
                <Icon name="lucide:user-cog" class="size-4 text-primary" />
                What's your role?
                <span class="text-destructive ml-1">*</span>
              </UiLabel>
              <p class="text-sm text-muted-foreground mt-1">
                We'll customize your experience
              </p>
            </div>
            <UiBadge v-if="role" variant="outline" class="text-sm font-medium w-fit">
              {{ roles.find((r) => r.value === role)?.label }}
            </UiBadge>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <button
              v-for="r in roles"
              :key="r.value"
              type="button"
              class="group relative flex flex-col items-center gap-3 p-5 border-2 rounded-2xl transition-all hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg"
              :class="
                role === r.value
                  ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-xl shadow-primary/20 scale-[1.02]'
                  : 'border-border'
              "
              @click="role = r.value"
            >
              <div
                class="flex size-14 items-center justify-center rounded-xl transition-all duration-300 shadow-sm"
                :class="
                  role === r.value
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-110'
                    : 'bg-muted text-muted-foreground group-hover:bg-gradient-to-br group-hover:from-primary/20 group-hover:to-primary/10 group-hover:text-primary group-hover:scale-105'
                "
              >
                <Icon :name="r.icon" class="size-7" />
              </div>
              <span class="font-semibold text-sm text-center leading-tight">{{ r.label }}</span>

              <!-- Check indicator -->
              <div
                v-if="role === r.value"
                class="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary shadow-lg border-4 border-background"
              >
                <Icon name="lucide:check" class="size-4 text-primary-foreground" />
              </div>
            </button>
          </div>
        </div>

        <!-- Team Size -->
        <div class="space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <UiLabel class="text-base font-semibold flex items-center gap-2">
                <Icon name="lucide:users" class="size-4 text-primary" />
                Team size?
                <span class="text-destructive ml-1">*</span>
              </UiLabel>
              <p class="text-sm text-muted-foreground mt-1">
                Choose the best plan for your needs
              </p>
            </div>
            <UiBadge v-if="teamSize" variant="outline" class="text-sm font-medium w-fit">
              {{ teamSizes.find((t) => t.value === teamSize)?.label }}
            </UiBadge>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <button
              v-for="size in teamSizes"
              :key="size.value"
              type="button"
              class="group relative flex flex-col items-center gap-3 p-5 border-2 rounded-2xl transition-all hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-primary/10 hover:scale-[1.03] active:scale-[0.97] hover:shadow-lg"
              :class="
                teamSize === size.value
                  ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-xl shadow-primary/20 scale-[1.02]'
                  : 'border-border'
              "
              @click="teamSize = size.value"
            >
              <div
                class="flex size-12 items-center justify-center rounded-xl transition-all duration-300 shadow-sm"
                :class="
                  teamSize === size.value
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-110'
                    : 'bg-muted text-muted-foreground group-hover:bg-gradient-to-br group-hover:from-primary/20 group-hover:to-primary/10 group-hover:text-primary group-hover:scale-105'
                "
              >
                <Icon :name="size.icon" class="size-6" />
              </div>
              <span class="font-semibold text-sm text-center leading-tight">{{ size.label }}</span>

              <!-- Check indicator -->
              <div
                v-if="teamSize === size.value"
                class="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary shadow-lg border-4 border-background"
              >
                <Icon name="lucide:check" class="size-4 text-primary-foreground" />
              </div>
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

      <UiButton size="lg" class="h-12 px-10 text-base shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" :disabled="!role || !teamSize" @click="handleNext">
        <span class="font-semibold">Continue</span>
        <Icon name="lucide:arrow-right" class="size-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </UiButton>
    </div>
  </div>
</template>
