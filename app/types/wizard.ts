export interface WizardData {
  // Step 1: Personal
  phone?: string
  avatar?: string

  // Step 2: Company
  companyName?: string
  role?: string
  teamSize?: string

  // Step 3: Use Case
  industry?: string
  primaryUseCase?: string
  goals?: string[]

  // Step 4: Plan
  selectedPlan?: "starter" | "professional" | "enterprise"
}

export type WizardStep = "personal" | "company" | "usecase" | "plan"
