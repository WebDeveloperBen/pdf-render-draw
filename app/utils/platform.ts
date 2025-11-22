/**
 * Platform Detection Utilities
 *
 * Provides safe, client-side platform detection with defensive checks.
 * Includes keyboard symbol mapping for platform-specific UI display.
 *
 * Usage:
 * const { isMacOS, isWindows, isMobile, getKbdKey } = usePlatform()
 * const cmdKey = getKbdKey('meta') // Returns '⌘' on Mac, 'Ctrl' on Windows
 */

import { computed, reactive, onMounted } from "vue"
import { createSharedComposable } from "@vueuse/core"

type KbdKeysSpecificMap = {
  meta: string
  alt: string
  ctrl: string
}

export const kbdKeysMap = {
  meta: "",
  ctrl: "",
  alt: "",
  win: "⊞",
  command: "⌘",
  shift: "⇧",
  control: "⌃",
  option: "⌥",
  enter: "↵",
  delete: "⌦",
  backspace: "⌫",
  escape: "Esc",
  tab: "⇥",
  capslock: "⇪",
  arrowup: "↑",
  arrowright: "→",
  arrowdown: "↓",
  arrowleft: "←",
  pageup: "⇞",
  pagedown: "⇟",
  home: "↖",
  end: "↘"
}

export type KbdKey = keyof typeof kbdKeysMap
export type KbdKeySpecific = keyof KbdKeysSpecificMap

const _usePlatform = () => {
  const userAgent = computed(() =>
    import.meta.client && navigator?.userAgent ? navigator.userAgent : ""
  )

  // Operating Systems
  const isMacOS = computed(() => /Macintosh;/i.test(userAgent.value))
  const isWindows = computed(() => /Windows/i.test(userAgent.value))
  const isLinux = computed(() => /Linux/i.test(userAgent.value) && !isAndroid.value)

  // Mobile
  const isIOS = computed(() => /iPhone|iPad|iPod/i.test(userAgent.value))
  const isAndroid = computed(() => /Android/i.test(userAgent.value))
  const isMobile = computed(() => isIOS.value || isAndroid.value)

  // Combined checks
  const isMac = computed(() => isMacOS.value || isIOS.value) // Mac includes iOS devices
  const isApple = computed(() => isMac.value) // Alias for clarity
  const macOS = computed(() => isMacOS.value) // Alias for compatibility

  // Touch support
  const hasTouch = computed(() =>
    import.meta.client &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  )

  // Keyboard key display mapping (platform-specific)
  const kbdKeysSpecificMap = reactive({
    meta: " ",
    alt: " ",
    ctrl: " "
  })

  onMounted(() => {
    kbdKeysSpecificMap.meta = isMacOS.value ? kbdKeysMap.command : "Ctrl"
    kbdKeysSpecificMap.ctrl = isMacOS.value ? kbdKeysMap.control : "Ctrl"
    kbdKeysSpecificMap.alt = isMacOS.value ? kbdKeysMap.option : "Alt"
  })

  function getKbdKey(value?: KbdKey | string) {
    if (!value) {
      return
    }

    if (["meta", "alt", "ctrl"].includes(value)) {
      return kbdKeysSpecificMap[value as KbdKeySpecific]
    }

    return kbdKeysMap[value as KbdKey] || value
  }

  return {
    userAgent,
    isMacOS,
    isWindows,
    isLinux,
    isIOS,
    isAndroid,
    isMobile,
    isMac,
    isApple,
    macOS, // Alias for compatibility with code expecting macOS
    hasTouch,
    getKbdKey
  }
}

export const usePlatform = createSharedComposable(_usePlatform)
