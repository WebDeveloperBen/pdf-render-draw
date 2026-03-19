import { beforeEach, describe, expect, it, vi } from "vitest"
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime"
import { ref } from "vue"
import InviteDialog from "./InviteDialog.vue"

const mockState = vi.hoisted(() => ({
  activeOrg: {
    data: {
      id: "org-1",
      name: "Acme Fitout"
    }
  } as { data: { id: string; name: string } } | null,
  formValues: {
    email: "worker@example.com",
    role: "member" as "member" | "admin"
  },
  inviteMember: vi.fn(),
  resetForm: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}))

mockNuxtImport("useActiveOrganization", () => {
  return () => ({
    activeOrg: ref(mockState.activeOrg)
  })
})

vi.mock("vee-validate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vee-validate")>()
  return {
    ...actual,
    useForm: () => ({
      handleSubmit: (callback: (values: typeof mockState.formValues) => Promise<void> | void) => () =>
        callback(mockState.formValues),
      resetForm: (...args: unknown[]) => mockState.resetForm(...args),
      values: mockState.formValues
    })
  }
})

vi.mock("~/utils/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: ref(null) }),
    organization: {
      inviteMember: (...args: unknown[]) => mockState.inviteMember(...args)
    }
  }
}))

vi.mock("vue-sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-sonner")>()
  return {
    ...actual,
    toast: {
      ...actual.toast,
      error: (...args: unknown[]) => mockState.toastError(...args),
      success: (...args: unknown[]) => mockState.toastSuccess(...args)
    }
  }
})

describe("InviteDialog", () => {
  beforeEach(() => {
    mockState.activeOrg = {
      data: {
        id: "org-1",
        name: "Acme Fitout"
      }
    }
    mockState.formValues.email = "worker@example.com"
    mockState.formValues.role = "member"
    mockState.inviteMember.mockReset()
    mockState.resetForm.mockReset()
    mockState.toastError.mockReset()
    mockState.toastSuccess.mockReset()
  })

  it("sends the invitation and closes the dialog on success", async () => {
    mockState.inviteMember.mockResolvedValue({ error: null })

    const wrapper = await mountSuspended(InviteDialog, {
      props: { open: true },
      global: {
        stubs: {
          UiDialog: { template: "<div><slot /></div>" },
          UiDialogContent: { template: "<div><slot /></div>" },
          UiDialogHeader: { template: "<div><slot /></div>" },
          UiDialogTitle: { template: "<div><slot /></div>" },
          UiDialogDescription: { template: "<div><slot /></div>" },
          UiDialogFooter: { template: "<div><slot /></div>" },
          UiFormBuilder: { template: "<div data-test='form-builder' />" },
          UiButton: { template: "<button @click=\"$emit('click')\"><slot /></button>" }
        }
      }
    })

    await wrapper.findAll("button")[1]?.trigger("click")

    expect(mockState.inviteMember).toHaveBeenCalledWith({
      email: "worker@example.com",
      role: "member",
      organizationId: "org-1"
    })
    expect(mockState.toastSuccess).toHaveBeenCalledWith("Invitation sent to worker@example.com")
    expect(mockState.resetForm).toHaveBeenCalled()
    expect(wrapper.emitted("update:open")).toContainEqual([false])
    expect(wrapper.emitted("invited")).toContainEqual([])
  })

  it("shows an error when there is no active workplace", async () => {
    mockState.activeOrg = null

    const wrapper = await mountSuspended(InviteDialog, {
      props: { open: true },
      global: {
        stubs: {
          UiDialog: { template: "<div><slot /></div>" },
          UiDialogContent: { template: "<div><slot /></div>" },
          UiDialogHeader: { template: "<div><slot /></div>" },
          UiDialogTitle: { template: "<div><slot /></div>" },
          UiDialogDescription: { template: "<div><slot /></div>" },
          UiDialogFooter: { template: "<div><slot /></div>" },
          UiFormBuilder: { template: "<div data-test='form-builder' />" },
          UiButton: { template: "<button @click=\"$emit('click')\"><slot /></button>" }
        }
      }
    })

    await wrapper.findAll("button")[1]?.trigger("click")

    expect(mockState.inviteMember).not.toHaveBeenCalled()
    expect(mockState.toastError).toHaveBeenCalledWith("No active workplace")
  })
})
