import { sendPasswordResetEmail, sendVerificationEmail as deliverVerificationEmail } from "../server/services/email/email.service"

export const emailVerificationConfig = {
  async sendVerificationEmail({ user, url }: { user: { email?: string }; url: string }) {
    if (!user.email) return
    // Append callbackURL so after verification, users land on our verify-email page
    const verificationUrl = new URL(url)
    verificationUrl.searchParams.set("callbackURL", `/verify-email?email=${encodeURIComponent(user.email)}`)
    await deliverVerificationEmail(user.email, verificationUrl.toString())
  },
  sendOnSignUp: true,
  autoSignInAfterVerification: true
}

export const emailAndPasswordConfig = {
  enabled: true,
  requireEmailVerification: false,
  async sendResetPassword({ user, url }: { user: { email?: string }; url: string }) {
    if (!user.email) return
    await sendPasswordResetEmail(user.email, url)
  }
}
