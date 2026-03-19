// Test setup file
// This runs before all tests

if (typeof window !== "undefined") {
  const storage = (() => {
    const values = new Map<string, string>()
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
      removeItem: (key: string) => {
        values.delete(key)
      },
      clear: () => {
        values.clear()
      }
    }
  })()

  if (!window.localStorage || typeof window.localStorage.setItem !== "function") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage
    })
  }

  window.__NUXT_COLOR_MODE__ = {
    preference: "dark",
    value: "dark",
    getColorScheme: () => "dark",
    addColorScheme: () => {},
    removeColorScheme: () => {}
  }
}
