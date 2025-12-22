<script setup lang="ts">
import { Html, Head, Preview, Body, Container, Section, Text, Button, Link, Heading, Hr } from "@vue-email/components"

const props = withDefaults(
  defineProps<{
    resetUrl: string
    appName?: string
    brandColor?: string
    footerText?: string
  }>(),
  {
    appName: "PDF Annotator",
    brandColor: "#f97316",
    footerText: "Professional PDF annotation tools"
  }
)

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif"
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "40px 20px",
    maxWidth: "560px",
    borderRadius: "8px"
  },
  logo: { fontSize: "24px", fontWeight: "700", color: props.brandColor, margin: "0" },
  heading: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#1f2937",
    margin: "0 0 16px 0",
    textAlign: "center" as const
  },
  text: { color: "#4b5563", fontSize: "16px", lineHeight: "24px", margin: "0 0 24px 0" },
  textMuted: { color: "#6b7280", fontSize: "14px", lineHeight: "20px", margin: "0 0 16px 0" },
  textSmall: { color: "#9ca3af", fontSize: "12px", lineHeight: "18px", margin: "0" },
  button: {
    backgroundColor: props.brandColor,
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    padding: "12px 32px",
    borderRadius: "6px",
    display: "inline-block"
  },
  link: { color: props.brandColor, fontSize: "12px", wordBreak: "break-all" as const },
  hr: { border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" },
  footer: { marginTop: "40px", paddingTop: "20px", borderTop: "1px solid #e6ebf1" },
  footerText: { color: "#8898aa", fontSize: "12px", textAlign: "center" as const, margin: "0" }
}
</script>

<template>
  <Html>
    <Head />
    <Preview>Reset your {{ appName }} password</Preview>
    <Body :style="styles.body">
      <Container :style="styles.container">
        <Section :style="{ textAlign: 'center', marginBottom: '32px' }">
          <Text :style="styles.logo">{{ appName }}</Text>
        </Section>

        <Heading :style="styles.heading">Reset your password</Heading>
        <Text :style="styles.text">
          You requested to reset your password. Click the button below to set a new password:
        </Text>

        <Section :style="{ textAlign: 'center', margin: '32px 0' }">
          <Button :href="resetUrl" :style="styles.button">Reset Password</Button>
        </Section>

        <Text :style="styles.textMuted">
          If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.
        </Text>

        <Hr :style="styles.hr" />

        <Text :style="styles.textSmall">
          If the button doesn't work, copy and paste this link into your browser:
        </Text>
        <Link :href="resetUrl" :style="styles.link">{{ resetUrl }}</Link>

        <Section :style="styles.footer">
          <Text :style="styles.footerText">{{ appName }} - {{ footerText }}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
</template>
