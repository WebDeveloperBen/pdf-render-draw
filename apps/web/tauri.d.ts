export {} // Ensures the file is treated as a module
declare global {
  interface Window {
    __TAURI__?: unknown //TODO: add / define more tauri plugins and function types here
  }
}
