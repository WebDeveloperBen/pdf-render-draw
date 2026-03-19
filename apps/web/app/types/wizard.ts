export type OnboardingPlanId = "free" | "professional" | "team" | "enterprise"

export interface WizardData {
  // Step 1: Personal
  firstName?: string
  lastName?: string
  phone?: string

  // Step 2: Company
  companyName?: string
  abn?: string
  role?: string
  teamSize?: string

  // Step 3: Use Case
  useCases?: string[]
  referralSource?: string

  // Step 4: Plan
  selectedPlan?: OnboardingPlanId
  selectedSeats?: number
}

export type WizardStep = "personal" | "company" | "usecase" | "plan"
