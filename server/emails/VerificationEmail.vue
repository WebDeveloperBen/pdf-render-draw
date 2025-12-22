<script setup lang="ts">
import { Html, Head, Preview, Body, Container, Section, Text, Button, Link, Heading, Hr } from "@vue-email/components"

const props = withDefaults(
  defineProps<{
    verificationUrl: string
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
    <Preview>Verify your email to get started</Preview>
    <Body :style="styles.body">
      <Container :style="styles.container">
        <Section :style="{ textAlign: 'center', marginBottom: '32px' }">
          <Text :style="styles.logo">{{ appName }}</Text>
        </Section>

        <Heading :style="styles.heading">Verify your email</Heading>
        <Text :style="styles.text">
          Thanks for signing up! Please verify your email address by clicking the button below:
        </Text>

        <Section :style="{ textAlign: 'center', margin: '32px 0' }">
          <Button :href="verificationUrl" :style="styles.button">Verify Email</Button>
        </Section>

        <Text :style="styles.textMuted">
          If you didn't create an account, you can safely ignore this email.
        </Text>

        <Hr :style="styles.hr" />

        <Text :style="styles.textSmall">
          If the button doesn't work, copy and paste this link into your browser:
        </Text>
        <Link :href="verificationUrl" :style="styles.link">{{ verificationUrl }}</Link>

        <Section :style="styles.footer">
          <Text :style="styles.footerText">{{ appName }} - {{ footerText }}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
</template>
