<script setup lang="ts">
import { CreditCard, ExternalLink, Calendar, Users } from "lucide-vue-next"

definePageMeta({ layout: "default" })
useSeoMeta({ title: "Billing" })

const { subscription, planName, isFreeTier, isPaid, isTrialing, isCanceling, trialEnd, limits } = useSubscription()
const { openBillingPortal, isLoading } = useCheckout()
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8">
    <div>
      <h1 class="text-2xl font-bold">Billing</h1>
      <p class="text-muted-foreground">Manage your subscription and billing details</p>
    </div>

    <!-- Current Plan Card -->
    <UiCard>
      <UiCardHeader>
        <div class="flex items-center justify-between">
          <div>
            <UiCardTitle>Current Plan</UiCardTitle>
            <UiCardDescription>
              <span class="capitalize">{{ planName }}</span>
              <UiBadge v-if="isTrialing" variant="secondary" class="ml-2">Trial</UiBadge>
              <UiBadge v-if="isCanceling" variant="destructive" class="ml-2">Cancelling</UiBadge>
            </UiCardDescription>
          </div>
          <UiButton v-if="isFreeTier" to="/pricing" variant="default"> Upgrade </UiButton>
        </div>
      </UiCardHeader>

      <UiCardContent v-if="isPaid" class="space-y-4">
        <!-- Subscription details -->
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="space-y-1">
            <p class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CreditCard class="size-3.5" /> Billing
            </p>
            <p class="text-sm font-medium capitalize">
              {{ subscription?.billingInterval ?? "monthly" }}
            </p>
          </div>

          <div class="space-y-1">
            <p class="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar class="size-3.5" /> Next billing date
            </p>
            <p class="text-sm font-medium">
              {{ subscription?.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : "\u2014" }}
            </p>
          </div>

          <div v-if="subscription?.seats" class="space-y-1">
            <p class="flex items-center gap-1.5 text-sm text-muted-foreground"><Users class="size-3.5" /> Seats</p>
            <p class="text-sm font-medium">{{ subscription.seats }}</p>
          </div>
        </div>

        <!-- Trial info -->
        <div v-if="isTrialing && trialEnd" class="rounded-md border border-primary/20 bg-primary/5 p-3">
          <p class="text-sm">
            Your trial ends on
            <span class="font-medium">{{ trialEnd.toLocaleDateString() }}</span
            >. Add a payment method to continue after your trial.
          </p>
        </div>

        <!-- Cancellation info -->
        <div v-if="isCanceling" class="rounded-md border border-destructive/20 bg-destructive/5 p-3">
          <p class="text-sm">
            Your subscription will end on
            <span class="font-medium">
              {{
                subscription?.periodEnd
                  ? new Date(subscription.periodEnd).toLocaleDateString()
                  : "the end of your billing period"
              }} </span
            >. You can reactivate from the billing portal.
          </p>
        </div>
      </UiCardContent>

      <!-- Free tier content -->
      <UiCardContent v-else class="space-y-3">
        <p class="text-sm text-muted-foreground">
          You're on the free plan. Upgrade to unlock more projects, advanced tools, and cloud sync.
        </p>
        <div class="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{{ limits.projects }} project{{ limits.projects !== 1 ? "s" : "" }}</span>
          <span>{{ limits.fileSizeMb }} MB uploads</span>
          <span>PDF export only</span>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Manage Subscription (paid users) -->
    <UiCard v-if="isPaid">
      <UiCardHeader>
        <UiCardTitle>Manage Subscription</UiCardTitle>
        <UiCardDescription> Update payment method, change plan, view invoices, or cancel </UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="flex flex-wrap gap-3">
          <UiButton variant="outline" :disabled="isLoading" @click="openBillingPortal('/organisation/billing')">
            <ExternalLink class="mr-2 size-4" />
            Open Billing Portal
          </UiButton>
          <UiButton variant="outline" to="/pricing"> Compare Plans </UiButton>
        </div>
        <p class="mt-3 text-xs text-muted-foreground">
          The billing portal is powered by Stripe and lets you update your card, download invoices, and manage your
          subscription.
        </p>
        <p v-if="planName === 'team'" class="mt-2 text-xs text-muted-foreground">
          Need more seats? Use Compare Plans to increase your Team seat count before inviting more members.
        </p>
      </UiCardContent>
    </UiCard>

    <!-- Usage Summary -->
    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Usage</UiCardTitle>
        <UiCardDescription>Current usage against your plan limits</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <div class="space-y-4">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span>Projects</span>
              <span class="text-muted-foreground">
                {{ limits.projects === -1 ? "Unlimited" : `of ${limits.projects}` }}
              </span>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span>File size limit</span>
              <span class="text-muted-foreground">{{ limits.fileSizeMb }} MB per file</span>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span>Storage</span>
              <span class="text-muted-foreground">
                {{ limits.storageMb === -1 ? "Unlimited" : `${limits.storageMb} MB` }}
              </span>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
