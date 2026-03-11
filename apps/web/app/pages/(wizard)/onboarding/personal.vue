<script setup lang="ts">
import type { WizardData } from "~/types/wizard"
import { toast } from "vue-sonner"

definePageMeta({
  layout: "wizard"
})

const wizardData = useState<WizardData>("wizard-data", () => ({}))
const session = authClient.useSession()

const phone = ref(wizardData.value.phone || "")

// Check if we have a real name (not just email prefix)
const userFirstName = computed(() => {
  const name = session.value.data?.user.name
  const email = session.value.data?.user.email

  // If no name, or name matches email prefix, use generic greeting
  if (!name) return null
  const emailPrefix = email?.split("@")[0]?.toLowerCase()
  if (name.toLowerCase() === emailPrefix) return null

  // Return first name only
  return name.split(" ")[0]
})

const handleNext = () => {
  if (phone.value) {
    const phoneRegex = /^[\d\s\-+()]+$/
    if (!phoneRegex.test(phone.value)) {
      toast.error("Please enter a valid phone number")
      return
    }
    wizardData.value.phone = phone.value
  }

  navigateTo("/onboarding/company")
}

const handleSkip = () => {
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
          <Icon name="lucide:user-circle" class="size-10 text-primary-foreground" />
        </div>
      </div>
      <div class="space-y-2">
        <h2
          class="text-4xl sm:text-5xl font-bold tracking-tight bg-linear-to-br from-foreground via-foreground to-foreground/70 bg-clip-text"
        >
          Welcome aboard!
        </h2>
        <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          Just a few details to get you started
        </p>
      </div>
    </div>

    <!-- Main Card -->
    <UiCard
      class="border-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 overflow-hidden bg-linear-to-br from-background via-background to-muted/5"
    >
      <UiCardContent class="p-6 sm:p-10 space-y-8">
        <!-- User Greeting -->
        <div class="flex items-center gap-4">
          <div
            class="flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/10"
          >
            <Icon name="lucide:hand-metal" class="size-6 text-primary" />
          </div>
          <div>
            <p class="text-2xl font-bold">Hey{{ userFirstName ? ` ${userFirstName}` : " there" }}!</p>
            <p class="text-sm text-muted-foreground flex items-center gap-1.5">
              <Icon name="lucide:mail" class="size-3.5" />
              Signed in as {{ session.data?.user.email }}
            </p>
          </div>
        </div>

        <!-- Phone Input -->
        <div class="space-y-4">
          <div>
            <UiLabel for="phone" class="text-base font-semibold flex items-center gap-2">
              <Icon name="lucide:phone" class="size-4 text-primary" />
              Phone Number
              <UiBadge variant="secondary" class="ml-auto text-xs font-normal">Optional</UiBadge>
            </UiLabel>
            <p class="text-sm text-muted-foreground mt-1.5">Stay connected with instant project notifications</p>
          </div>

          <div class="relative group/input">
            <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
              <Icon
                name="lucide:smartphone"
                class="size-5 text-muted-foreground group-focus-within/input:text-primary transition-all duration-300"
              />
            </div>
            <UiInput
              id="phone"
              v-model="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              class="pl-14 h-14 text-base border-2 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all shadow-sm hover:shadow-md hover:border-primary/50"
              @keyup.enter="handleNext"
            />
          </div>

          <div class="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon name="lucide:shield-check" class="size-5 text-primary" />
            </div>
            <div class="space-y-1 pt-0.5">
              <p class="text-sm font-medium">Your privacy matters</p>
              <p class="text-xs text-muted-foreground leading-relaxed">
                Your number appears on quotes you share and helps your team reach you. Never used for marketing.
              </p>
            </div>
          </div>
        </div>

        <!-- Benefits Section -->
        <div class="pt-2 space-y-5">
          <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border">
              <Icon name="lucide:sparkles" class="size-3.5 text-primary" />
              <span class="text-sm font-semibold text-muted-foreground">Benefits</span>
            </div>
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          <div class="grid sm:grid-cols-3 gap-4">
            <div
              class="group/benefit flex flex-col items-start gap-3 p-5 rounded-xl border-2 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-default"
            >
              <div
                class="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/10 group-hover/benefit:from-primary group-hover/benefit:to-primary/90 transition-all shadow-sm group-hover/benefit:shadow-lg group-hover/benefit:shadow-primary/20"
              >
                <Icon
                  name="lucide:users"
                  class="size-5 text-primary group-hover/benefit:text-primary-foreground transition-colors"
                />
              </div>
              <div class="space-y-1">
                <p class="text-sm font-semibold">Team coordination</p>
                <p class="text-xs text-muted-foreground leading-relaxed">
                  Easy for collaborators to reach you on projects
                </p>
              </div>
            </div>

            <div
              class="group/benefit flex flex-col items-start gap-3 p-5 rounded-xl border-2 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-default"
            >
              <div
                class="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/10 group-hover/benefit:from-primary group-hover/benefit:to-primary/90 transition-all shadow-sm group-hover/benefit:shadow-lg group-hover/benefit:shadow-primary/20"
              >
                <Icon
                  name="lucide:file-text"
                  class="size-5 text-primary group-hover/benefit:text-primary-foreground transition-colors"
                />
              </div>
              <div class="space-y-1">
                <p class="text-sm font-semibold">Professional quotes</p>
                <p class="text-xs text-muted-foreground leading-relaxed">Your contact details on shared estimates</p>
              </div>
            </div>

            <div
              class="group/benefit flex flex-col items-start gap-3 p-5 rounded-xl border-2 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-default"
            >
              <div
                class="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/10 group-hover/benefit:from-primary group-hover/benefit:to-primary/90 transition-all shadow-sm group-hover/benefit:shadow-lg group-hover/benefit:shadow-primary/20"
              >
                <Icon
                  name="lucide:headphones"
                  class="size-5 text-primary group-hover/benefit:text-primary-foreground transition-colors"
                />
              </div>
              <div class="space-y-1">
                <p class="text-sm font-semibold">Direct support</p>
                <p class="text-xs text-muted-foreground leading-relaxed">Our team can call you if you need help</p>
              </div>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Actions -->
    <div
      class="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300"
    >
      <UiButton variant="ghost" size="lg" class="group h-12 px-6 text-base" @click="handleSkip">
        <span>Skip for now</span>
        <Icon name="lucide:chevron-right" class="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </UiButton>

      <UiButton
        size="lg"
        class="h-12 px-10 text-base shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/90 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] group"
        @click="handleNext"
      >
        <span class="font-semibold">Continue</span>
        <Icon name="lucide:arrow-right" class="size-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </UiButton>
    </div>
  </div>
</template>
