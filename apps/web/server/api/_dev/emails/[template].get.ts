import { render } from "@vue-email/render"
import PasswordResetEmail from "~~/server/services/email/PasswordResetEmail.vue"
import VerificationEmail from "~~/server/services/email/VerificationEmail.vue"
import MagicLinkEmail from "~~/server/services/email/MagicLinkEmail.vue"
import OrganizationInviteEmail from "~~/server/services/email/OrganizationInviteEmail.vue"

export default defineEventHandler(async (event) => {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404, message: "Not found" })
  }

  const config = useRuntimeConfig()
  const branding = {
    appName: config.app.name,
    brandColor: config.app.brandColor,
    footerText: config.app.footerText
  }

  const templates = {
    "password-reset": {
      component: PasswordResetEmail,
      props: { resetUrl: "https://example.com/reset?token=abc123", ...branding }
    },
    verification: {
      component: VerificationEmail,
      props: { verificationUrl: "https://example.com/verify?token=xyz789", ...branding }
    },
    "magic-link": {
      component: MagicLinkEmail,
      props: { magicLinkUrl: "https://example.com/auth/magic?token=magic456", ...branding }
    },
    "organization-invite": {
      component: OrganizationInviteEmail,
      props: {
        inviteUrl: "https://example.com/invite/abc",
        organizationName: "Acme Construction Co.",
        inviterName: "John Smith",
        ...branding
      }
    }
  } as const

  const template = getRouterParam(event, "template") as keyof typeof templates

  if (!template || !templates[template]) {
    throw createError({ statusCode: 404, message: `Template "${template}" not found` })
  }

  const { component, props } = templates[template]
  const html = await render(component, props)

  setHeader(event, "Content-Type", "text/html")
  return html
})
