# macOS App Store Release

This file covers the `native-apple-release.yml` macOS path.

## Current placeholder values

- Product name: `MetreMate`
- Bundle identifier base: `com.metremate.app`
- Suggested macOS App Store bundle identifier: `com.metremate.app.macos`

You can keep these as placeholders until you create the App Store Connect record. Once Apple records exist, do not rename casually.

## What must exist before the first real release

- Apple Developer Program account
- App Store Connect access for the team
- A macOS app record in App Store Connect
- Apple Distribution certificate exported as `.p12`
- Mac Installer Distribution certificate exported as `.p12`
- Mac App Store provisioning profile for the final bundle identifier
- App metadata in App Store Connect:
  - description
  - keywords
  - privacy policy URL
  - support URL
  - screenshots
  - age rating
  - app review contact details
  - export compliance answers

## GitHub secrets required

Create these in the `apple-production` environment:

- `APPLE_API_ISSUER_ID`
- `APPLE_API_KEY_ID`
- `APPLE_API_PRIVATE_KEY_P8_BASE64`
- `APPLE_TEAM_ID`
- `APPLE_DISTRIBUTION_CERTIFICATE_P12_BASE64`
- `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`
- `APPLE_INSTALLER_CERTIFICATE_P12_BASE64`
- `APPLE_INSTALLER_CERTIFICATE_PASSWORD`
- `APPLE_MACOS_PROVISION_PROFILE_BASE64`
- `APPLE_INSTALLER_SIGNING_IDENTITY`

## Files in this repo that matter

- [native-apple-release.yml](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/.github/workflows/native-apple-release.yml)
- [tauri.apple.json](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/release/tauri.apple.json)
- [Info.appstore.plist](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/src-tauri/Info.appstore.plist)
- [tauri.conf.json](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/src-tauri/tauri.conf.json)

## First-time setup sequence

1. Decide whether `com.metremate.app.macos` is the final macOS identifier.
2. Create the macOS app in App Store Connect with that identifier.
3. Create the provisioning profile for the same identifier.
4. Export the two Apple certificates as `.p12`.
5. Base64-encode the `.p12`, `.p8`, and provisioning profile files and load them into GitHub secrets.
6. Confirm `Info.appstore.plist` still matches your export-compliance answer.
7. Run the Apple workflow manually with `publish=false` or `dry_run=true`.

## What the workflow does

1. Installs dependencies and Rust targets.
2. Resolves the release version from the workflow input or `native-vX.Y.Z` tag.
3. Materialises the Apple signing files on the runner.
4. Builds the macOS `.app`.
5. Packages a signed `.pkg` for App Store upload.
6. Uploads the artefacts to App Store Connect when publishing is enabled.

## What is still manual even after CI is working

- App Review submission strategy
- Release timing
- Metadata and screenshot maintenance
- Responding to App Review issues

## Recommended next move

Do not try to finalise this target first. Apple is certificate-heavy and will be easier after the mobile shell is committed and the common naming is locked.
