# Tauri Native App Wrapper

## Overview

The PDF annotation editor deployed as native iOS and Android applications using Tauri v2. The app is essentially the Nuxt SPA wrapped in a native shell with platform-specific features like secure token storage, camera access, and offline capabilities.

## Technology Stack

- **Tauri v2**: Native app framework (Rust + WebView)
- **Nuxt 4**: SPA mode for the frontend
- **Better Auth**: JWT/Bearer plugin for native auth
- **Tauri Plugins**:
  - `tauri-plugin-http`: Native HTTP client
  - `tauri-plugin-store`: Secure preferences
  - `tauri-plugin-biometric`: Face ID / Fingerprint
  - `tauri-plugin-camera`: Photo capture

## Authentication Strategy

### Adaptive Auth (Cookie vs JWT)

The key insight: use cookies for web (better security, automatic handling) and JWT for native (required for non-browser context).

```typescript
// composables/useTauri.ts
export function useTauri() {
  const isTauri = computed(() => {
    if (import.meta.server) return false
    return typeof window !== "undefined" && "__TAURI__" in window
  })

  const isNative = computed(() => isTauri.value)
  const isWeb = computed(() => !isTauri.value)

  async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauri.value) {
      throw new Error("Tauri not available")
    }
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(command, args)
  }

  return {
    isTauri,
    isNative,
    isWeb,
    invoke
  }
}
```

### Native Auth Composable

```typescript
// composables/useNativeAuth.ts
import { authClient } from "~/auth-client"

export function useNativeAuth() {
  const { isTauri, invoke } = useTauri()

  // Token storage for native apps
  async function storeTokens(accessToken: string, refreshToken: string) {
    if (!isTauri.value) return

    await invoke("store_auth_tokens", {
      accessToken,
      refreshToken
    })
  }

  async function getTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (!isTauri.value) return null

    try {
      return await invoke("get_auth_tokens")
    } catch {
      return null
    }
  }

  async function clearTokens() {
    if (!isTauri.value) return
    await invoke("clear_auth_tokens")
  }

  // Sign in with token storage for native
  async function signIn(email: string, password: string) {
    if (isTauri.value) {
      // Use JWT auth for native
      const result = await authClient.signIn.email({
        email,
        password,
        // Request tokens instead of cookies
        fetchOptions: {
          headers: {
            "X-Request-Token": "true"
          }
        }
      })

      if (result.data?.token) {
        await storeTokens(result.data.token, result.data.refreshToken)
      }

      return result
    } else {
      // Use default cookie auth for web
      return authClient.signIn.email({ email, password })
    }
  }

  // Get auth headers for API requests
  async function getAuthHeaders(): Promise<Record<string, string>> {
    if (isTauri.value) {
      const tokens = await getTokens()
      if (tokens?.accessToken) {
        return { Authorization: `Bearer ${tokens.accessToken}` }
      }
    }
    // Web uses cookies automatically
    return {}
  }

  // Refresh token for native
  async function refreshSession() {
    if (!isTauri.value) return

    const tokens = await getTokens()
    if (!tokens?.refreshToken) return

    const result = await authClient.refreshToken({
      refreshToken: tokens.refreshToken
    })

    if (result.data?.token) {
      await storeTokens(result.data.token, result.data.refreshToken)
    }
  }

  async function signOut() {
    if (isTauri.value) {
      await clearTokens()
    }
    await authClient.signOut()
    navigateTo("/login")
  }

  return {
    signIn,
    signOut,
    getAuthHeaders,
    refreshSession,
    storeTokens,
    getTokens,
    clearTokens
  }
}
```

### Auth Client Configuration

```typescript
// utils/auth-client.ts
import { createAuthClient } from "better-auth/vue"
import { bearer } from "@better-auth/bearer/client"
import { jwt } from "@better-auth/jwt/client"

// Check if running in Tauri
const isTauri = typeof window !== "undefined" && "__TAURI__" in window

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "",
  plugins: [
    // Enable bearer/JWT for native apps
    ...(isTauri ? [bearer(), jwt()] : [])
  ],
  fetchOptions: {
    // Include credentials for cookie auth on web
    credentials: isTauri ? "omit" : "include"
  }
})
```

### Server-Side Auth Configuration

```typescript
// server/utils/auth.ts
import { betterAuth } from "better-auth"
import { bearer } from "@better-auth/bearer"
import { jwt } from "@better-auth/jwt"

export const auth = betterAuth({
  // ... base config

  plugins: [
    // Bearer token auth for native apps
    bearer({
      // Token lives in Authorization header
    }),

    // JWT plugin for stateless tokens
    jwt({
      // JWT configuration
      jwt: {
        expiresIn: "7d",
        issuer: "yourapp.com"
      },
      // Refresh token configuration
      refreshToken: {
        enabled: true,
        expiresIn: "30d"
      }
    })
  ],

  // Allow both cookie and bearer auth
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5
    }
  }
})
```

## Tauri Rust Commands

### Token Storage

```rust
// src-tauri/src/commands/auth.rs
use tauri_plugin_store::StoreExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
}

#[tauri::command]
pub async fn store_auth_tokens(
    app: tauri::AppHandle,
    access_token: String,
    refresh_token: String,
) -> Result<(), String> {
    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    // Store tokens securely
    store.set("access_token", access_token);
    store.set("refresh_token", refresh_token);
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_auth_tokens(app: tauri::AppHandle) -> Result<Option<AuthTokens>, String> {
    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    let access_token = store.get("access_token");
    let refresh_token = store.get("refresh_token");

    match (access_token, refresh_token) {
        (Some(at), Some(rt)) => Ok(Some(AuthTokens {
            access_token: at.as_str().unwrap_or_default().to_string(),
            refresh_token: rt.as_str().unwrap_or_default().to_string(),
        })),
        _ => Ok(None),
    }
}

#[tauri::command]
pub async fn clear_auth_tokens(app: tauri::AppHandle) -> Result<(), String> {
    let store = app.store("auth.json").map_err(|e| e.to_string())?;

    store.delete("access_token");
    store.delete("refresh_token");
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}
```

### Biometric Authentication

```rust
// src-tauri/src/commands/auth.rs (continued)
use tauri_plugin_biometric::BiometricExt;

#[tauri::command]
pub async fn authenticate_biometric(app: tauri::AppHandle) -> Result<bool, String> {
    let biometric = app.biometric();

    // Check if biometric is available
    let status = biometric.status().await.map_err(|e| e.to_string())?;

    if !status.is_available {
        return Err("Biometric not available".to_string());
    }

    // Authenticate
    let result = biometric
        .authenticate("Unlock PDF Editor".to_string(), None)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn is_biometric_available(app: tauri::AppHandle) -> Result<bool, String> {
    let biometric = app.biometric();
    let status = biometric.status().await.map_err(|e| e.to_string())?;
    Ok(status.is_available)
}
```

## Tauri Configuration

### Main Config

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "PDF Annotate",
  "identifier": "com.yourcompany.pdfannotate",
  "version": "1.0.0",
  "build": {
    "frontendDist": "../.output/public"
  },
  "app": {
    "withGlobalTauri": true,
    "security": {
      "csp": null
    },
    "windows": [
      {
        "title": "PDF Annotate",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "iOS": {
      "developmentTeam": "YOUR_TEAM_ID"
    }
  },
  "plugins": {
    "store": {
      "path": "auth.json"
    },
    "http": {
      "scope": {
        "allow": [{ "url": "https://api.yourapp.com/**" }, { "url": "https://*.stripe.com/**" }]
      }
    }
  }
}
```

### Capabilities

```json
// src-tauri/capabilities/mobile.json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "mobile-capabilities",
  "platforms": ["iOS", "android"],
  "permissions": [
    "core:default",
    "store:default",
    "http:default",
    "biometric:default",
    {
      "identifier": "http:allow-fetch",
      "allow": [{ "url": "https://api.yourapp.com/**" }]
    },
    "camera:default",
    "fs:default"
  ]
}
```

## Native HTTP Client

### API Fetch Wrapper

```typescript
// composables/useNativeFetch.ts
export function useNativeFetch() {
  const { isTauri, invoke } = useTauri()
  const { getAuthHeaders } = useNativeAuth()

  async function nativeFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const authHeaders = await getAuthHeaders()

    if (isTauri.value) {
      // Use Tauri's HTTP client for native
      const { fetch } = await import("@tauri-apps/plugin-http")

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...options.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    } else {
      // Use regular fetch for web
      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    }
  }

  return { nativeFetch }
}
```

## Deep Linking

### URL Scheme Registration

```json
// src-tauri/tauri.conf.json (partial)
{
  "plugins": {
    "deep-link": {
      "mobile": [{ "host": "yourapp.com", "pathPrefix": ["/"] }],
      "desktop": {
        "schemes": ["pdfannotate"]
      }
    }
  }
}
```

### Deep Link Handler

```typescript
// composables/useDeepLinks.ts
export function useDeepLinks() {
  const { isTauri } = useTauri()
  const router = useRouter()

  async function setupDeepLinks() {
    if (!isTauri.value) return

    const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link")

    await onOpenUrl((urls) => {
      for (const url of urls) {
        handleDeepLink(url)
      }
    })
  }

  function handleDeepLink(url: string) {
    const parsed = new URL(url)

    // Handle different deep link paths
    switch (parsed.pathname) {
      case "/editor":
        const docId = parsed.searchParams.get("doc")
        if (docId) {
          router.push(`/editor/${docId}`)
        }
        break

      case "/invite":
        const sessionId = parsed.searchParams.get("session")
        if (sessionId) {
          router.push(`/join/${sessionId}`)
        }
        break

      case "/reset-password":
        const token = parsed.searchParams.get("token")
        if (token) {
          router.push(`/reset-password?token=${token}`)
        }
        break
    }
  }

  onMounted(setupDeepLinks)

  return { handleDeepLink }
}
```

## Build & Deployment

### Development

```bash
# Install Tauri CLI
pnpm add -D @tauri-apps/cli

# Initialize Tauri in project
pnpm tauri init

# Add mobile targets
pnpm tauri android init
pnpm tauri ios init

# Run in development
pnpm tauri dev              # Desktop
pnpm tauri android dev      # Android
pnpm tauri ios dev          # iOS
```

### Production Build

```bash
# Build Nuxt SPA first
pnpm generate

# Build native apps
pnpm tauri build            # Desktop
pnpm tauri android build    # Android APK/AAB
pnpm tauri ios build        # iOS IPA
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/mobile.yml
name: Mobile Build

on:
  push:
    tags:
      - "v*"

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-linux-android,armv7-linux-androideabi

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install dependencies
        run: pnpm install

      - name: Build frontend
        run: pnpm generate

      - name: Build Android
        run: pnpm tauri android build

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: android-apk
          path: src-tauri/gen/android/app/build/outputs/apk/

  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-ios,x86_64-apple-ios

      - name: Install dependencies
        run: pnpm install

      - name: Build frontend
        run: pnpm generate

      - name: Build iOS
        run: pnpm tauri ios build

      - name: Upload IPA
        uses: actions/upload-artifact@v4
        with:
          name: ios-ipa
          path: src-tauri/gen/apple/build/
```

## Platform-Specific Considerations

### iOS

- **Safe Areas**: Handle notch and home indicator
- **Keyboard**: Adjust viewport when keyboard appears
- **App Transport Security**: HTTPS required
- **Push Notifications**: APNs integration
- **File Picker**: Use native document picker

### Android

- **Back Button**: Handle navigation properly
- **Permissions**: Request at runtime
- **Keyboard**: Adjust for soft keyboard
- **Intent Filters**: Deep linking setup
- **Storage**: Scoped storage for Android 11+

## Acceptance Criteria

### Authentication

- [ ] JWT/Bearer auth works in native app
- [ ] Tokens stored securely (Keychain/Keystore)
- [ ] Token refresh works automatically
- [ ] Biometric unlock works
- [ ] Sign out clears all tokens

### Web Parity

- [ ] All editor features work identically
- [ ] All annotation tools functional
- [ ] PDF rendering matches web
- [ ] Transform handles work with touch
- [ ] Zoom/pan gestures work

### Native Features

- [ ] Deep links open correct screens
- [ ] Camera integration works
- [ ] File system access works
- [ ] Offline mode persists data
- [ ] Push notifications received

### Platform Compliance

- [ ] iOS App Store guidelines met
- [ ] Google Play guidelines met
- [ ] Privacy policy accessible
- [ ] Permissions explained to user

### Performance

- [ ] App launches in < 3 seconds
- [ ] Smooth 60fps scrolling
- [ ] Memory usage acceptable
- [ ] Battery usage reasonable
