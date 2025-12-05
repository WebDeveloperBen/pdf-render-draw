<script setup lang="ts">
import { toast } from "vue-sonner"

const email = ref("")
const password = ref("")
const isLoading = ref(false)

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

    toast.success("Signed in successfully")
    navigateTo("/")
  } catch (error: any) {
    toast.error(error.message || "Failed to sign in")
  } finally {
    isLoading.value = false
  }
}

const handleSignUp = async () => {
  isLoading.value = true
  try {
    const result = await authClient.signUp.email({
      email: email.value,
      password: password.value,
      name: email.value.split("@")[0] || "User",
      firstName: "Test",
      lastName: "User"
    })

    if (result.error) {
      toast.error(result.error.message || "Failed to create account")
      return
    }

    toast.success("Account created successfully")
    navigateTo("/")
  } catch (error: any) {
    toast.error(error.message || "Failed to create account")
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background">
    <UiCard class="w-full max-w-md">
      <UiCardHeader>
        <UiCardTitle>Sign In</UiCardTitle>
        <UiCardDescription>Enter your email and password to continue</UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="space-y-4">
        <div class="space-y-2">
          <UiLabel for="email">Email</UiLabel>
          <UiInput id="email" v-model="email" type="email" placeholder="you@example.com" :disabled="isLoading" />
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
      </UiCardContent>
      <UiCardFooter class="flex flex-col gap-2">
        <UiButton class="w-full" :disabled="isLoading || !email || !password" @click="handleSignIn"> Sign In </UiButton>
        <UiButton variant="outline" class="w-full" :disabled="isLoading || !email || !password" @click="handleSignUp">
          Create Account
        </UiButton>
      </UiCardFooter>
    </UiCard>
  </div>
</template>
