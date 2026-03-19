import { beforeEach, describe, expect, it, vi } from "vitest"

const mockState = vi.hoisted(() => {
  const send = vi.fn()
  const render = vi.fn()
  const Resend = vi.fn(function MockResend() {
    return {
      emails: {
        send
      }
    }
  })

  return {
    send,
    render,
    Resend
  }
})

const mockConfig = {
  resendApiKey: "re_test_123",
  emailFrom: "noreply@example.test",
  public: {
    app: {
      name: "MetreMate",
      brandColor: "#ff6600",
      footerText: "Built for the trades"
    }
  }
}

vi.mock("resend", () => ({
  Resend: mockState.Resend
}))

vi.mock("@vue-email/render", () => ({
  render: (...args: unknown[]) => mockState.render(...args)
}))

vi.mock("../../utils/runtime-config", () => ({
  getOptionalRuntimeConfig: () => mockConfig
}))

async function loadService() {
  vi.resetModules()
  return await import("./email.service")
}

describe("email service", () => {
  beforeEach(() => {
    mockState.send.mockReset()
    mockState.render.mockReset()
    mockState.Resend.mockClear()
  })

  it("renders and sends the password reset email with branding", async () => {
    mockState.render.mockResolvedValue("<p>password reset</p>")
    mockState.send.mockResolvedValue({
      data: { id: "email-1" },
      error: null
    })

    const emailService = await loadService()
    const result = await emailService.sendPasswordResetEmail("user@example.com", "https://example.test/reset")

    expect(mockState.Resend).toHaveBeenCalledWith("re_test_123")
    expect(mockState.render).toHaveBeenCalledWith(expect.anything(), {
      resetUrl: "https://example.test/reset",
      appName: "MetreMate",
      brandColor: "#ff6600",
      footerText: "Built for the trades"
    })
    expect(mockState.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.test",
        to: "user@example.com",
        subject: "Reset your password",
        html: "<p>password reset</p>"
      })
    )
    expect(result).toEqual({ id: "email-1" })
  })

  it("propagates provider errors when the email send fails", async () => {
    const providerError = new Error("Resend unavailable")
    mockState.send.mockResolvedValue({
      data: null,
      error: providerError
    })

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const emailService = await loadService()

    await expect(
      emailService.sendEmail({
        to: "user@example.com",
        subject: "Subject",
        html: "<p>Hello</p>"
      })
    ).rejects.toThrow("Resend unavailable")

    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
