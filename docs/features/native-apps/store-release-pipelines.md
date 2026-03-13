# Native Store Release Guide

This is the parent document for native store distribution.

The repo now has working release workflow scaffolding for these targets:

- [macOS App Store](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/apple-macos-app-store.md)
- [iPhone and iPad App Store](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/apple-ios-ipados-app-store.md)
- [Google Play for Android phone and tablet](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/google-play-android.md)
- [Microsoft Store for Windows](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/microsoft-store-windows.md)

## Current repo state

- Native workflows exist in `.github/workflows/`
- Shared release scripts exist in `apps/native/scripts/release/`
- Release overlays exist in `apps/native/release/`
- Temporary app identity is now set to:
  - Product name: `MetreMate`
  - Bundle identifier: `com.metremate.app`

These values are good enough to keep building the pipeline work now. You do not need store accounts yet to keep moving. If you later change the bundle identifier after creating store records, that will create avoidable churn, so treat `com.metremate.app` as the intended default unless you know it is wrong.

## What is still intentionally blocked

You cannot do a real store release yet because these external prerequisites still do not exist:

- Apple Developer / App Store Connect account and app records
- Google Play Console account and app record
- Microsoft Partner Center account and product record
- Signing certificates, provisioning profiles, and keystores
- Committed generated mobile projects under `apps/native/src-tauri/gen/apple` and `apps/native/src-tauri/gen/android`

## Common next steps from here

1. Generate and commit the mobile shells:
   ```bash
   pnpm --filter @pdf-annotator/native exec tauri ios init --ci --skip-targets-install
   pnpm --filter @pdf-annotator/native exec tauri android init --ci --skip-targets-install
   ```
2. Read the target-specific documents below and prepare the account, certificates, and metadata checklist for each store.
3. Create the GitHub environments and secrets once you have the signing material.
4. Dry run the workflows with `workflow_dispatch` before the first real tag.

## Workflow map

- `native-validate.yml`
  Repo-level validation. Safe to run before any store accounts exist.
- `native-apple-release.yml`
  Builds and signs macOS and iOS artefacts, then uploads to App Store Connect.
- `native-android-release.yml`
  Builds and signs an Android AAB, then uploads it to Google Play.
- `native-windows-release.yml`
  Builds and signs a Windows MSI, then attaches it to the GitHub release. The final Microsoft Store submission step is still manual by design.

## GitHub environments

Create these environments when you start adding secrets:

- `apple-production`
- `google-play-production`
- `windows-production`

## Local validation

Base check:

```bash
pnpm native:release:validate -- --platform all
```

Stricter checks once secrets exist:

```bash
pnpm --filter @pdf-annotator/native run release:validate -- --platform apple --strict --require-secrets
pnpm --filter @pdf-annotator/native run release:validate -- --platform android --strict --require-secrets
pnpm --filter @pdf-annotator/native run release:validate -- --platform windows --strict --require-secrets
```

## Target documents

- [macOS App Store](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/apple-macos-app-store.md)
- [iPhone and iPad App Store](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/apple-ios-ipados-app-store.md)
- [Google Play for Android](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/google-play-android.md)
- [Microsoft Store for Windows](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/docs/features/native-apps/store-release/microsoft-store-windows.md)
