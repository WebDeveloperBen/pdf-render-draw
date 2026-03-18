import { Resend } from "resend"
import { render } from "@vue-email/render"
import PasswordResetEmail from "./PasswordResetEmail.vue"
import VerificationEmail from "./VerificationEmail.vue"
import MagicLinkEmail from "./MagicLinkEmail.vue"
import OrganizationInviteEmail from "./OrganizationInviteEmail.vue"

// Lazy-initialized Resend client
let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient) {
    const config = useRuntimeConfig()
    resendClient = new Resend(config.resendApiKey)
  }
  return resendClient
}

function getFromEmail(): string {
  const config = useRuntimeConfig()
  return config.emailFrom
}

function getEmailBranding() {
  const config = useRuntimeConfig()
  return {
    appName: config.app.name,
    brandColor: config.app.brandColor,
    footerText: config.app.footerText
  }
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  try {
    const resend = getResendClient()
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text
    })

    if (error) {
      console.error("[Email] Failed to send:", error)
      throw error
    }

    console.log("[Email] Sent successfully:", data?.id)
    return data
  } catch (error) {
    console.error("[Email] Error:", error)
    throw error
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const branding = getEmailBranding()
  const html = await render(PasswordResetEmail, { resetUrl, ...branding })

  return sendEmail({
    to: email,
    subject: "Reset your password",
    html,
    text: `Reset your password\n\nYou requested to reset your password. Click the link below to set a new password:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email. This link will expire in 1 hour.`
  })
}

export async function sendVerificationEmail(email: string, verificationUrl: string) {
  const branding = getEmailBranding()
  const html = await render(VerificationEmail, { verificationUrl, ...branding })

  return sendEmail({
    to: email,
    subject: "Verify your email address",
    html,
    text: `Verify your email\n\nThanks for signing up! Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nIf you didn't create an account, you can safely ignore this email.`
  })
}

export async function sendMagicLinkEmail(email: string, magicLinkUrl: string) {
  const branding = getEmailBranding()
  const html = await render(MagicLinkEmail, { magicLinkUrl, ...branding })

  return sendEmail({
    to: email,
    subject: "Your sign-in link",
    html,
    text: `Sign in to ${branding.appName}\n\nClick the link below to sign in to your account:\n\n${magicLinkUrl}\n\nThis link will expire in 7 days. If you didn't request this, you can safely ignore this email.`
  })
}

export async function sendOrganizationInviteEmail(
  email: string,
  inviteUrl: string,
  organizationName: string,
  inviterName: string
) {
  const branding = getEmailBranding()
  const html = await render(OrganizationInviteEmail, {
    inviteUrl,
    organizationName,
    inviterName,
    ...branding
  })

  return sendEmail({
    to: email,
    subject: `You've been invited to join ${organizationName}`,
    html,
    text: `You're invited!\n\n${inviterName} has invited you to join ${organizationName} on ${branding.appName}.\n\nClick the link below to accept:\n\n${inviteUrl}`
  })
}
