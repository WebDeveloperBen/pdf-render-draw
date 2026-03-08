<script setup lang="ts">
import { toast } from "vue-sonner"
definePageMeta({
  layout: false
})

const route = useRoute()
const token = computed(() => {
  const params = route.params
  if ("token" in params) return params.token as string
  return ""
})

// Form state
const email = ref("")
const password = ref("")
const firstName = ref("")
const lastName = ref("")
const isLoading = ref(false)
const activeTab = ref<"login" | "register">("login")

// Get current session
const session = authClient.useSession()

// Fetch invitation details
const {
  data: invitation,
  status: invitationStatus,
  error: invitationError
} = await useAsyncData(
  `invitation-${token.value}`,
  async () => {
    const result = await authClient.organization.getInvitation({
      query: { id: token.value }
    })
    if (result.error) {
      throw new Error(result.error.message || "Invalid invitation")
    }
    return result.data
  },
  { server: false }
)

// Pre-fill email from invitation
watch(
  invitation,
  (inv) => {
    if (inv?.email) {
      email.value = inv.email
    }
  },
  { immediate: true }
)

// Check if current user's email matches invitation
const emailMismatch = computed(() => {
  if (!session.value?.data?.user?.email || !invitation.value?.email) return false
  return session.value.data.user.email.toLowerCase() !== invitation.value.email.toLowerCase()
})

// Handle sign in
const handleSignIn = async () => {
  isLoading.value = true
  try {
    const result = await authClient.signIn.email({
      email: email.value,
      password: password.value
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to sign in")
      return
    }

    // After sign in, accept the invitation
    await acceptInvitationHandler()
  } catch (error: any) {
    toast.error(error.message || "Failed to sign in")
  } finally {
    isLoading.value = false
  }
}

// Handle sign up
const handleSignUp = async () => {
  if (!firstName.value || !lastName.value) {
    toast.error("Please enter your first and last name")
    return
  }

  isLoading.value = true
  try {
    const result = await authClient.signUp.email({
      email: email.value,
      password: password.value,
      name: `${firstName.value} ${lastName.value}`,
      firstName: firstName.value,
      lastName: lastName.value
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to create account")
      return
    }

    // After sign up, accept the invitation
    await acceptInvitationHandler()
  } catch (error: any) {
    toast.error(error.message || "Failed to create account")
  } finally {
    isLoading.value = false
  }
}

// Sign out and reload invite page
const handleSignOutAndReload = async () => {
  await authClient.signOut()
  await navigateTo(`/invite/${token.value}`)
}

// Accept invitation
const acceptInvitationHandler = async () => {
  isLoading.value = true
  try {
    const result = await authClient.organization.acceptInvitation({
      invitationId: token.value
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to accept invitation")
      return
    }

    // Set the invited organization as active
    if (invitation.value?.organizationId) {
      await authClient.organization.setActive({
        organizationId: invitation.value.organizationId
      })
    }

    toast.success(`Welcome to ${invitation.value?.organizationName || "the organization"}!`)
    await navigateTo("/")
  } catch (error: any) {
    toast.error(error.message || "Failed to accept invitation")
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <!-- Loading state -->
    <UiCard v-if="invitationStatus === 'pending'" class="w-full max-w-md">
      <UiCardContent class="flex items-center justify-center py-12">
        <Icon name="svg-spinners:ring-resize" class="size-8 text-primary" />
      </UiCardContent>
    </UiCard>

    <!-- Error state -->
    <UiCard v-else-if="invitationStatus === 'error' || !invitation" class="w-full max-w-md">
      <UiCardHeader>
        <UiCardTitle class="text-destructive">Invalid Invitation</UiCardTitle>
        <UiCardDescription>
          {{ invitationError?.message || "This invitation link is invalid or has expired." }}
        </UiCardDescription>
      </UiCardHeader>
      <UiCardFooter>
        <UiButton variant="outline" class="w-full" @click="navigateTo('/login')"> Go to Login </UiButton>
      </UiCardFooter>
    </UiCard>

    <!-- Invitation details -->
    <UiCard v-else class="w-full max-w-md">
      <UiCardHeader class="text-center">
        <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Icon name="lucide:building-2" class="size-8 text-primary" />
        </div>
        <UiCardTitle>You're invited!</UiCardTitle>
        <UiCardDescription>
          You've been invited to join
          <span class="font-semibold text-foreground">{{ invitation.organizationName }}</span>
          as a <span class="font-medium">{{ invitation.role }}</span>
        </UiCardDescription>
      </UiCardHeader>

      <UiCardContent>
        <!-- Already logged in with matching email -->
        <div v-if="session?.data?.user && !emailMismatch" class="space-y-4">
          <div class="rounded-lg border bg-muted/50 p-4">
            <p class="text-sm text-muted-foreground">
              Signed in as <span class="font-medium text-foreground">{{ session.data.user.email }}</span>
            </p>
          </div>
          <UiButton class="w-full" :disabled="isLoading" @click="acceptInvitationHandler">
            <Icon v-if="isLoading" name="svg-spinners:ring-resize" class="size-4" />
            Accept Invitation
          </UiButton>
        </div>

        <!-- Email mismatch warning -->
        <div v-else-if="session?.data?.user && emailMismatch" class="space-y-4">
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p class="text-sm text-destructive">
              This invitation was sent to
              <span class="font-medium">{{ invitation.email }}</span
              >, but you're signed in as <span class="font-medium">{{ session.data.user.email }}</span
              >.
            </p>
          </div>
          <UiButton variant="outline" class="w-full" @click="handleSignOutAndReload">
            Sign out and use correct account
          </UiButton>
        </div>

        <!-- Not logged in - show login/register form -->
        <div v-else class="space-y-4">
          <div class="rounded-lg border bg-muted/50 p-3 text-center">
            <p class="text-sm text-muted-foreground">
              Invitation for <span class="font-medium text-foreground">{{ invitation.email }}</span>
            </p>
          </div>

          <!-- Tabs -->
          <div class="flex gap-2">
            <UiButton
              :variant="activeTab === 'login' ? 'default' : 'outline'"
              class="flex-1"
              @click="activeTab = 'login'"
            >
              Sign In
            </UiButton>
            <UiButton
              :variant="activeTab === 'register' ? 'default' : 'outline'"
              class="flex-1"
              @click="activeTab = 'register'"
            >
              Create Account
            </UiButton>
          </div>

          <!-- Login form -->
          <div v-if="activeTab === 'login'" class="space-y-4">
            <div class="space-y-2">
              <UiLabel for="email">Email</UiLabel>
              <UiInput
                id="email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                :disabled="isLoading"
                readonly
              />
            </div>
            <div class="space-y-2">
              <UiLabel for="password">Password</UiLabel>
              <UiInput
                id="password"
                v-model="password"
                type="password"
                placeholder="••••••••"
                :disabled="isLoading"
                @keyup.enter="handleSignIn"
              />
            </div>
            <UiButton class="w-full" :disabled="isLoading || !password" @click="handleSignIn">
              <Icon v-if="isLoading" name="svg-spinners:ring-resize" class="size-4" />
              Sign In & Accept
            </UiButton>
          </div>

          <!-- Register form -->
          <div v-else class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <UiLabel for="firstName">First Name</UiLabel>
                <UiInput id="firstName" v-model="firstName" type="text" placeholder="John" :disabled="isLoading" />
              </div>
              <div class="space-y-2">
                <UiLabel for="lastName">Last Name</UiLabel>
                <UiInput id="lastName" v-model="lastName" type="text" placeholder="Doe" :disabled="isLoading" />
              </div>
            </div>
            <div class="space-y-2">
              <UiLabel for="registerEmail">Email</UiLabel>
              <UiInput
                id="registerEmail"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                :disabled="isLoading"
                readonly
              />
            </div>
            <div class="space-y-2">
              <UiLabel for="registerPassword">Password</UiLabel>
              <UiInput
                id="registerPassword"
                v-model="password"
                type="password"
                placeholder="••••••••"
                :disabled="isLoading"
                @keyup.enter="handleSignUp"
              />
            </div>
            <UiButton
              class="w-full"
              :disabled="isLoading || !password || !firstName || !lastName"
              @click="handleSignUp"
            >
              <Icon v-if="isLoading" name="svg-spinners:ring-resize" class="size-4" />
              Create Account & Accept
            </UiButton>
          </div>
        </div>
      </UiCardContent>

      <UiCardFooter class="flex-col gap-2 text-center">
        <p class="text-xs text-muted-foreground">
          By accepting, you'll join {{ invitation.organizationName }} and have access to their shared resources.
        </p>
      </UiCardFooter>
    </UiCard>
  </div>
</template>
