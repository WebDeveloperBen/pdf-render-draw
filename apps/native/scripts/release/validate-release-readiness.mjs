import path from "node:path"
import process from "node:process"

import {
  baseTauriConfigPath,
  exists,
  parseArgs,
  readTauriConfig,
  repoRoot,
  srcTauriDir,
  toBoolean,
} from "./utils.mjs"

const args = parseArgs(process.argv.slice(2))
const platform = args.platform ?? "all"
const strict = toBoolean(args.strict, false)
const requireSecrets = toBoolean(args["require-secrets"], strict)

const config = readTauriConfig()
const errors = []
const warnings = []
const reporter = strict ? errors : warnings

validateBaseConfig()
validatePlatform(platform)

if (warnings.length > 0) {
  console.log("Release readiness warnings:")
  for (const warning of warnings) {
    console.log(`- ${warning}`)
  }
}

if (errors.length > 0) {
  console.error("Release readiness errors:")
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

if (warnings.length === 0) {
  console.log(`Release readiness check passed for platform "${platform}".`)
}

function validateBaseConfig() {
  if (!exists(baseTauriConfigPath)) {
    errors.push("apps/native/src-tauri/tauri.conf.json is missing.")
    return
  }

  if (config.identifier === "com.tauri.dev") {
    reporter.push("Replace the default Tauri bundle identifier in apps/native/src-tauri/tauri.conf.json before releasing.")
  }

  if (config.productName === "pdf-rend") {
    reporter.push("Replace the placeholder product name in apps/native/src-tauri/tauri.conf.json before releasing.")
  }
}

function validatePlatform(selectedPlatform) {
  const selectedPlatforms = selectedPlatform === "all"
    ? ["apple", "android", "windows"]
    : [selectedPlatform]

  for (const currentPlatform of selectedPlatforms) {
    if (currentPlatform === "apple") {
      validateApple()
      continue
    }

    if (currentPlatform === "android") {
      validateAndroid()
      continue
    }

    if (currentPlatform === "windows") {
      validateWindows()
      continue
    }

    reporter.push(`Unknown platform "${currentPlatform}".`)
  }
}

function validateApple() {
  const requiredFiles = [
    path.resolve(repoRoot, "apps/native/release/tauri.apple.json"),
    path.resolve(srcTauriDir, "Info.appstore.plist"),
  ]

  for (const filePath of requiredFiles) {
    if (!exists(filePath)) {
      errors.push(`Missing Apple release file: ${path.relative(repoRoot, filePath)}`)
    }
  }

  if (!exists(path.resolve(srcTauriDir, "gen/apple"))) {
    reporter.push("Run `pnpm --filter @pdf-annotator/native exec tauri ios init --ci --skip-targets-install` and commit apps/native/src-tauri/gen/apple before Apple releases.")
  }

  if (!requireSecrets) {
    return
  }

  requireEnv("APPLE_API_ISSUER_ID")
  requireEnv("APPLE_API_KEY_ID")
  requireEnv("APPLE_API_PRIVATE_KEY_P8_BASE64")
  requireEnv("APPLE_TEAM_ID")
  requireEnv("APPLE_DISTRIBUTION_CERTIFICATE_P12_BASE64")
  requireEnv("APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD")
  requireEnv("APPLE_INSTALLER_CERTIFICATE_P12_BASE64")
  requireEnv("APPLE_INSTALLER_CERTIFICATE_PASSWORD")
  requireEnv("APPLE_MACOS_PROVISION_PROFILE_BASE64")
  requireEnv("APPLE_INSTALLER_SIGNING_IDENTITY")
}

function validateAndroid() {
  if (!exists(path.resolve(repoRoot, "apps/native/release/tauri.android.json"))) {
    errors.push("Missing Android release overlay: apps/native/release/tauri.android.json")
  }

  if (!exists(path.resolve(srcTauriDir, "gen/android"))) {
    reporter.push("Run `pnpm --filter @pdf-annotator/native exec tauri android init --ci --skip-targets-install` and commit apps/native/src-tauri/gen/android before Android releases.")
  }

  if (!requireSecrets) {
    return
  }

  requireEnv("ANDROID_KEYSTORE_BASE64")
  requireEnv("ANDROID_KEYSTORE_PASSWORD")
  requireEnv("ANDROID_KEY_ALIAS")
  requireEnv("ANDROID_KEY_PASSWORD")
  requireEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
  requireEnv("ANDROID_PACKAGE_NAME")
}

function validateWindows() {
  if (!exists(path.resolve(repoRoot, "apps/native/release/tauri.windows.json"))) {
    errors.push("Missing Windows release overlay: apps/native/release/tauri.windows.json")
  }

  if (!requireSecrets) {
    return
  }

  requireEnv("WINDOWS_CERTIFICATE_PFX_BASE64")
  requireEnv("WINDOWS_CERTIFICATE_PASSWORD")
}

function requireEnv(name) {
  if (!process.env[name]) {
    errors.push(`Missing required environment variable ${name}.`)
  }
}
