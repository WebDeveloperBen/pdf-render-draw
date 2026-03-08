/**
 * Cleanup Service Workers Plugin
 *
 * This plugin unregisters any stray service workers that might interfere
 * with the app, especially in Tauri's WebView which shares storage with Safari.
 *
 * The "FetchEvent.respondWith" error in WebKit can occur when orphaned
 * service workers have broken fetch handlers.
 */
export default defineNuxtPlugin(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
        console.info("[cleanup] Unregistered stray service worker:", registration.scope)
      }
    })
  }
})
