import { $fetch } from "@nuxt/test-utils/e2e"

interface TestStatePatch {
  billing?: {
    fullSyncResult?: {
      synced: number
      created: number
      updated: number
      errors: number
      duration: number
    } | null
    refreshStatus?: string | null
    cancelStatus?: string | null
    reactivateStatus?: string | null
    portalUrl?: string | null
  }
  r2?: {
    failPut?: boolean
  }
}

export async function patchServerTestState(patch: TestStatePatch) {
  return $fetch("/api/_test/state", {
    method: "PATCH",
    body: patch
  })
}

export async function resetServerTestState() {
  return $fetch("/api/_test/state", {
    method: "DELETE"
  })
}
