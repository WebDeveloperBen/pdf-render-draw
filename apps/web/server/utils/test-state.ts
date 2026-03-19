interface BillingTestState {
  fullSyncResult: {
    synced: number
    created: number
    updated: number
    errors: number
    duration: number
  } | null
  refreshStatus: string | null
  cancelStatus: string | null
  reactivateStatus: string | null
  portalUrl: string | null
}

interface R2TestState {
  failPut: boolean
}

export interface AppTestState {
  billing: BillingTestState
  r2: R2TestState
}

export interface AppTestStatePatch {
  billing?: Partial<BillingTestState>
  r2?: Partial<R2TestState>
}

declare global {
  // eslint-disable-next-line no-var
  var __appTestState__: AppTestState | undefined
  // eslint-disable-next-line no-var
  var __appTestR2Store__: Map<string, Uint8Array> | undefined
}

const DEFAULT_TEST_STATE: AppTestState = {
  billing: {
    fullSyncResult: null,
    refreshStatus: null,
    cancelStatus: null,
    reactivateStatus: null,
    portalUrl: null
  },
  r2: {
    failPut: false
  }
}

function cloneDefaultState(): AppTestState {
  return {
    billing: {
      fullSyncResult: DEFAULT_TEST_STATE.billing.fullSyncResult,
      refreshStatus: DEFAULT_TEST_STATE.billing.refreshStatus,
      cancelStatus: DEFAULT_TEST_STATE.billing.cancelStatus,
      reactivateStatus: DEFAULT_TEST_STATE.billing.reactivateStatus,
      portalUrl: DEFAULT_TEST_STATE.billing.portalUrl
    },
    r2: {
      failPut: DEFAULT_TEST_STATE.r2.failPut
    }
  }
}

function isTestEnv(): boolean {
  return process.env.VITEST === "true"
}

export function getTestState(): AppTestState | null {
  if (!isTestEnv()) return null
  if (!globalThis.__appTestState__) {
    globalThis.__appTestState__ = cloneDefaultState()
  }
  return globalThis.__appTestState__
}

export function requireTestState(): AppTestState {
  const state = getTestState()
  if (!state) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not found"
    })
  }
  return state
}

export function patchTestState(patch: AppTestStatePatch): AppTestState {
  const state = requireTestState()

  if (patch.billing) {
    state.billing = {
      ...state.billing,
      ...patch.billing
    }
  }

  if (patch.r2) {
    state.r2 = {
      ...state.r2,
      ...patch.r2
    }
  }

  return state
}

export function resetTestState(): AppTestState {
  const nextState = cloneDefaultState()
  globalThis.__appTestState__ = nextState
  globalThis.__appTestR2Store__ = new Map()
  return nextState
}

export function getTestR2Store(): Map<string, Uint8Array> | null {
  if (!isTestEnv()) return null
  if (!globalThis.__appTestR2Store__) {
    globalThis.__appTestR2Store__ = new Map()
  }
  return globalThis.__appTestR2Store__
}
