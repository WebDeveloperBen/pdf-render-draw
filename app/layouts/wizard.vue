<script setup lang="ts">
const route = useRoute()

const steps = [
  { path: "/onboarding/personal", label: "Personal", step: 1 },
  { path: "/onboarding/company", label: "Company", step: 2 },
  { path: "/onboarding/usecase", label: "Use Case", step: 3 },
  { path: "/onboarding/plan", label: "Plan", step: 4 }
]

const currentStepIndex = computed(() => {
  return steps.findIndex((s) => s.path === route.path)
})

const progress = computed(() => {
  if (currentStepIndex.value === -1) return 0
  return ((currentStepIndex.value + 1) / steps.length) * 100
})

const currentYear = computed(() => new Date().getFullYear())
</script>

<template>
  <div class="min-h-screen flex flex-col bg-linear-to-br from-background via-background to-muted/20">
    <!-- Background pattern -->
    <div class="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

    <div class="relative flex flex-col flex-1">
      <!-- Header -->
      <header class="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div class="container max-w-7xl mx-auto px-6 sm:px-8 pt-6 pb-12">
          <!-- Single row: Logo, Steps, Secure setup -->
          <div class="hidden md:flex items-center justify-between gap-8">
            <!-- Logo (left) -->
            <div class="flex items-center gap-3 shrink-0">
              <div
                class="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
              >
                <Icon name="lucide:ruler" class="size-5" />
              </div>
              <div>
                <h1 class="text-xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text">
                  MetreMate
                </h1>
                <p class="text-xs text-muted-foreground">Setup your account</p>
              </div>
            </div>

            <!-- Step indicators (center) -->
            <div class="flex items-center justify-center gap-0">
              <div v-for="(step, index) in steps" :key="step.path" class="flex items-center">
                <!-- Step bubble -->
                <div class="flex flex-col items-center gap-2 relative px-2">
                  <div
                    class="flex size-10 items-center justify-center rounded-full font-semibold text-sm transition-all duration-300 relative z-10"
                    :class="
                      index < currentStepIndex
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                        : index === currentStepIndex
                          ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/40 ring-4 ring-primary/20 scale-110'
                          : 'bg-muted text-muted-foreground'
                    "
                  >
                    <Icon v-if="index < currentStepIndex" name="lucide:check" class="size-5" />
                    <span v-else>{{ step.step }}</span>
                  </div>
                  <span
                    class="text-xs font-medium transition-colors absolute top-12 whitespace-nowrap"
                    :class="index <= currentStepIndex ? 'text-foreground' : 'text-muted-foreground'"
                  >
                    {{ step.label }}
                  </span>
                </div>

                <!-- Connector line -->
                <div
                  v-if="index < steps.length - 1"
                  class="h-0.5 w-24 transition-all duration-500 rounded-full"
                  :class="index < currentStepIndex ? 'bg-primary shadow-sm' : 'bg-muted'"
                />
              </div>
            </div>

            <!-- Secure setup (right) -->
            <div class="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Icon name="lucide:shield-check" class="size-4 text-primary" />
              <span>Secure setup</span>
            </div>
          </div>

          <!-- Mobile header -->
          <div class="md:hidden space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <Icon name="lucide:ruler" class="size-5" />
                </div>
                <div>
                  <h1 class="text-xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text">
                    MetreMate
                  </h1>
                  <p class="text-xs text-muted-foreground">Setup your account</p>
                </div>
              </div>

              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="lucide:shield-check" class="size-4 text-primary" />
              </div>
            </div>

            <!-- Mobile progress -->
            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium">Step {{ currentStepIndex + 1 }} of {{ steps.length }}</span>
                <span class="text-muted-foreground">{{ steps[currentStepIndex]?.label }}</span>
              </div>
              <div class="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  class="absolute top-0 left-0 h-full bg-linear-to-r from-primary to-primary/80 transition-all duration-500 ease-out shadow-lg shadow-primary/50"
                  :style="{ width: `${progress}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="container max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1">
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <slot />
        </div>
      </main>

      <!-- Footer -->
      <footer class="border-t">
        <div class="container max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {{ currentYear }} MetreMate. All rights reserved.</p>
            <div class="flex items-center gap-4">
              <a href="/support" class="hover:text-foreground transition-colors">Support</a>
              <span class="text-border">•</span>
              <a href="/privacy" class="hover:text-foreground transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.bg-grid-pattern {
  background-image:
    linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px);
  background-size: 24px 24px;
}

@keyframes slide-in-from-bottom-4 {
  from {
    transform: translateY(1rem);
  }
  to {
    transform: translateY(0);
  }
}

.animate-in {
  animation-fill-mode: both;
}

.fade-in {
  animation-name: fade-in;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.slide-in-from-bottom-4 {
  animation-name: slide-in-from-bottom-4;
}

.duration-500 {
  animation-duration: 500ms;
}
</style>
