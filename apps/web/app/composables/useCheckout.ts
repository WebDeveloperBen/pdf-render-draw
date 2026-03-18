import { toast } from "vue-sonner"
import { subscriptionClient$ } from "~/utils/auth-client"

/**
 * Handles Stripe checkout flow via Better Auth subscription client.
 * Wraps subscriptionClient$.upgrade() with loading state and error handling.
 */
export function useCheckout() {
  const isLoading = ref(false)
  const { activeOrg } = useActiveOrganization()

  async function checkout(planName: string, options?: { seats?: number; annual?: boolean }) {
    const orgId = activeOrg.value?.data?.id
    if (!orgId) {
      toast.error("No active organization. Please select an organization first.")
      return
    }

    isLoading.value = true

    try {
      const { error } = await subscriptionClient$.upgrade({
        plan: planName.toLowerCase(),
        referenceId: orgId,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/checkout/cancel`,
        ...(options?.seats ? { seats: options.seats } : {}),
        ...(options?.annual ? { annual: true } : {})
      })

      if (error) {
        toast.error(error.message || "Failed to start checkout")
      }
      // If no error, Better Auth redirects to Stripe — no further action needed
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again."
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }

  async function openBillingPortal(returnPath = "/organisation") {
    const orgId = activeOrg.value?.data?.id
    if (!orgId) {
      toast.error("No active organization")
      return
    }

    try {
      await subscriptionClient$.billingPortal({
        referenceId: orgId,
        returnUrl: `${window.location.origin}${returnPath}`
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to open billing portal"
      toast.error(message)
    }
  }

  return {
    checkout,
    openBillingPortal,
    isLoading: readonly(isLoading)
  }
}
