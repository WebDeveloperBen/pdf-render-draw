# iPhone and iPad App Store Release

This file covers the `native-apple-release.yml` iOS and iPadOS path.

## Current placeholder values

- Product name: `MetreMate`
- Bundle identifier base: `com.metremate.app`
- Suggested iOS bundle identifier: `com.metremate.app.ios`

Apple treats iPhone and iPad distribution as one iOS app unless you deliberately split products. The current plan assumes one shared iOS listing.

## What must exist before the first real release

- Apple Developer Program account
- App Store Connect iOS app record
- iOS provisioning profile for the final bundle identifier
- Apple Distribution certificate exported as `.p12`
- App Store Connect API key
- Completed App Store metadata:
  - app name
  - subtitle
  - privacy policy URL
  - support URL
  - screenshots for required device sizes
  - age rating
  - App Privacy answers
  - export compliance answers

## GitHub secrets required

The Apple workflow shares the same `apple-production` environment as macOS:

- `APPLE_API_ISSUER_ID`
- `APPLE_API_KEY_ID`
- `APPLE_API_PRIVATE_KEY_P8_BASE64`
- `APPLE_TEAM_ID`
- `APPLE_DISTRIBUTION_CERTIFICATE_P12_BASE64`
- `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`

## Files in this repo that matter

- [native-apple-release.yml](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/.github/workflows/native-apple-release.yml)
- [tauri.conf.json](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/src-tauri/tauri.conf.json)
- [gen/apple](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/src-tauri/gen/apple)

## First-time setup sequence

1. Generate and commit the iOS shell:
   ```bash
   pnpm --filter @pdf-annotator/native exec tauri ios init --ci --skip-targets-install
   ```
2. Decide whether `com.metremate.app.ios` is the final iOS identifier.
3. Create the iOS app record in App Store Connect.
4. Create the provisioning profile.
5. Export the signing certificate and API key materials.
6. Populate the GitHub Apple secrets.
7. Run the Apple workflow manually with `publish=false` or `dry_run=true`.

## What the workflow does

1. Builds the web app and native iOS archive.
2. Exports an App Store-ready `.ipa`.
3. Uploads the `.ipa` to App Store Connect when publishing is enabled.

## What remains manual

- TestFlight group management
- Production submission timing
- Screenshot and metadata updates
- App Review responses

## Recommended next move

This is the most important Apple target if mobile is your primary goal. Commit `gen/apple` before doing any account work.
