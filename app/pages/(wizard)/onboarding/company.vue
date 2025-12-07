<script setup lang="ts">
import type { WizardData } from "~/types/wizard"
import { toast } from "vue-sonner"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))

const companyName = ref(wizardData.value.companyName || "")
const abn = ref(wizardData.value.abn || "")
const role = ref(wizardData.value.role || "")
const teamSize = ref(wizardData.value.teamSize || "")

// Format ABN as XX XXX XXX XXX
const formatAbn = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
}

const handleAbnInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  abn.value = formatAbn(input.value)
}

const roles = [
  { value: "contractor", label: "Contractor", icon: "lucide:hard-hat" },
  { value: "pm", label: "Project Manager", icon: "lucide:clipboard-list" },
  { value: "architect", label: "Architect", icon: "lucide:pencil-ruler" },
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
  if (!companyName.value.trim()) {
    toast.error("Please enter your company name")
    return
  }

  if (!role.value) {
    toast.error("Please select your role")
    return
  }

  if (!teamSize.value) {
    toast.error("Please select your team size")
    return
  }

  wizardData.value.companyName = companyName.value
  wizardData.value.abn = abn.value.replace(/\s/g, "") // Store without spaces
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
        <div class="space-y-3">
          <div>
            <UiLabel for="company" class="text-base font-semibold justify-start">
              <Icon name="lucide:building-2" class="size-4 text-primary" />
              Company Name
              <span class="text-destructive">*</span>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              This will appear on your quotes and invoices
            </p>
          </div>
          <div class="relative group/input">
            <UiInput
              id="company"
              v-model="companyName"
              placeholder="Acme Construction Co."
              class="h-12 text-base border-2 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all shadow-sm hover:shadow-md hover:border-primary/50"
            />
          </div>
        </div>

        <!-- ABN -->
        <div class="space-y-3">
          <div>
            <UiLabel for="abn" class="text-base font-semibold flex items-center gap-2">
              <Icon name="lucide:file-check" class="size-4 text-primary" />
              ABN
              <UiBadge variant="secondary" class="ml-auto text-xs font-normal">Optional</UiBadge>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              Australian Business Number for invoicing
            </p>
          </div>
          <div class="relative group/input">
            <UiInput
              id="abn"
              :model-value="abn"
              placeholder="12 345 678 901"
              class="h-12 text-base border-2 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all shadow-sm hover:shadow-md hover:border-primary/50 font-mono tracking-wide"
              @input="handleAbnInput"
            />
          </div>
        </div>

        <!-- Team Size -->
        <div class="space-y-4">
          <div>
            <UiLabel class="text-base font-semibold justify-start">
              <Icon name="lucide:users" class="size-4 text-primary" />
              Team size?
              <span class="text-destructive">*</span>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              Helps us recommend the right plan
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="size in teamSizes"
              :key="size.value"
              type="button"
              class="flex items-center gap-2 px-4 py-2.5 border-2 rounded-full transition-all text-sm font-medium"
              :class="
                teamSize === size.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/30 hover:bg-muted/50'
              "
              @click="teamSize = size.value"
            >
              <Icon :name="size.icon" class="size-4" />
              <span>{{ size.label }}</span>
            </button>
          </div>
        </div>

        <!-- Role Selection -->
        <div class="space-y-4">
          <div>
            <UiLabel class="text-base font-semibold justify-start">
              <Icon name="lucide:user-cog" class="size-4 text-primary" />
              What's your role?
              <span class="text-destructive">*</span>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1">
              We'll customize your experience
            </p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              v-for="r in roles"
              :key="r.value"
              type="button"
              class="group relative flex flex-col items-center gap-3 p-4 border-2 rounded-xl transition-all hover:border-primary/40 hover:bg-primary/5"
              :class="
                role === r.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              "
              @click="role = r.value"
            >
              <div
                class="flex size-12 items-center justify-center rounded-lg transition-all"
                :class="
                  role === r.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                "
              >
                <Icon :name="r.icon" class="size-6" />
              </div>
              <span class="font-medium text-sm text-center">{{ r.label }}</span>

              <!-- Check indicator -->
              <div
                v-if="role === r.value"
                class="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-primary border-2 border-background"
              >
                <Icon name="lucide:check" class="size-3.5 text-primary-foreground" />
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

      <UiButton size="lg" class="h-12 px-10 text-base shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" :disabled="!companyName.trim() || !role || !teamSize" @click="handleNext">
        <span class="font-semibold">Continue</span>
        <Icon name="lucide:arrow-right" class="size-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </UiButton>
    </div>
  </div>
</template>
