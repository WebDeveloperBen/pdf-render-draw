/**
 * Debug Utility
 * Only logs in development mode to keep production console clean
 */

export const DEBUG = import.meta.env.DEV

export function debugLog(context: string, ...args: any[]) {
  if (DEBUG) {
    console.log(`[${context}]`, ...args)
  }
}

export function debugWarn(context: string, ...args: any[]) {
  if (DEBUG) {
    console.warn(`[${context}]`, ...args)
  }
}

export function debugError(context: string, ...args: any[]) {
  if (DEBUG) {
    console.error(`[${context}]`, ...args)
  }
}
