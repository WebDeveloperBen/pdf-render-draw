import type { GenericObject } from "vee-validate"
import type { ZodSchema } from "zod"

export interface FormStep {
  id: string
  label: string
  icon?: string
  description?: string
  schema?: ZodSchema
  required?: boolean
}

export interface UseMultiStepFormOptions<T extends GenericObject> {
  steps: FormStep[]
  initialValues?: Partial<T>
  onComplete?: (values: T) => void | Promise<void>
}

export function useMultiStepForm<T extends GenericObject>(options: UseMultiStepFormOptions<T>) {
  const { steps, initialValues = {}, onComplete } = options

  const currentStepIndex = ref(0)
  const formValues = ref<Partial<T>>(initialValues as Partial<T>)
  const stepErrors = ref<Record<string, string[]>>({})
  const isSubmitting = ref(false)

  const currentStep = computed(() => steps[currentStepIndex.value])
  const isFirstStep = computed(() => currentStepIndex.value === 0)
  const isLastStep = computed(() => currentStepIndex.value === steps.length - 1)
  const progress = computed(() => ((currentStepIndex.value + 1) / steps.length) * 100)

  // Track which steps have been completed
  const completedSteps = ref<Set<string>>(new Set())

  const stepStatus = computed(() => {
    return steps.reduce(
      (acc, step) => {
        acc[step.id] = completedSteps.value.has(step.id)
        return acc
      },
      {} as Record<string, boolean>
    )
  })

  // Validate current step using its schema
  async function validateCurrentStep(): Promise<boolean> {
    const step = currentStep.value
    if (!step || !step.schema) {
      return true
    }

    try {
      step.schema.parse(formValues.value)
      stepErrors.value[step.id] = []
      return true
    } catch (error: any) {
      if (error.errors) {
        stepErrors.value[step.id] = error.errors.map((e: any) => e.message)
      }
      return false
    }
  }

  // Go to next step (with validation)
  async function nextStep(): Promise<boolean> {
    const isValid = await validateCurrentStep()
    if (!isValid) {
      return false
    }

    const step = currentStep.value
    if (step) {
      completedSteps.value.add(step.id)
    }

    if (!isLastStep.value) {
      currentStepIndex.value++
    }
    return true
  }

  // Go to previous step
  function previousStep() {
    if (!isFirstStep.value) {
      currentStepIndex.value--
    }
  }

  // Go to specific step by id
  function goToStep(stepId: string) {
    const index = steps.findIndex((s) => s.id === stepId)
    if (index !== -1) {
      currentStepIndex.value = index
    }
  }

  // Update form values
  function updateValues(values: Partial<T>) {
    formValues.value = { ...formValues.value, ...values }
  }

  // Set a single value
  function setValue<K extends keyof T>(key: K, value: T[K]) {
    formValues.value = { ...formValues.value, [key]: value }
  }

  // Submit the form
  async function submit() {
    // Validate all required steps
    for (const step of steps) {
      if (step.required && step.schema) {
        try {
          step.schema.parse(formValues.value)
        } catch {
          // Navigate to the failed step
          goToStep(step.id)
          await validateCurrentStep()
          return false
        }
      }
    }

    if (onComplete) {
      isSubmitting.value = true
      try {
        await onComplete(formValues.value as T)
        return true
      } finally {
        isSubmitting.value = false
      }
    }
    return true
  }

  // Reset the form
  function reset() {
    currentStepIndex.value = 0
    formValues.value = initialValues as Partial<T>
    stepErrors.value = {}
    completedSteps.value.clear()
  }

  return {
    // State
    steps,
    currentStep,
    currentStepIndex,
    formValues,
    stepErrors,
    isSubmitting,

    // Computed
    isFirstStep,
    isLastStep,
    progress,
    stepStatus,

    // Methods
    nextStep,
    previousStep,
    goToStep,
    updateValues,
    setValue,
    validateCurrentStep,
    submit,
    reset
  }
}
