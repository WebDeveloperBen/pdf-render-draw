# Native Release Files

This directory holds the committed release overlays and helper inputs for the native store pipelines.

## Files

- `tauri.apple.json`
  App Store-specific Tauri config overlay. It points macOS builds at `Info.appstore.plist` and the embedded provisioning profile that the Apple workflow writes at runtime.
- `tauri.android.json`
  Android release overlay. The workflow injects the final `versionCode` at build time.
- `tauri.windows.json`
  Windows release overlay. It narrows bundling to MSI so the Windows workflow produces the Store-facing installer you will upload and sign.

## Local checks

Use these scripts before opening a release PR:

```bash
pnpm native:release:validate -- --platform all
pnpm --filter @pdf-annotator/native run release:prepare-config -- --platform windows --version 1.2.3 --output /tmp/tauri.release.windows.conf.json
```

## Deliberate gaps

- The repo still needs real store identifiers and final product naming in `apps/native/src-tauri/tauri.conf.json`.
- The repo still needs committed mobile projects under `apps/native/src-tauri/gen/apple` and `apps/native/src-tauri/gen/android`.
- The Microsoft Store workflow currently stops at a signed MSI plus a GitHub release attachment. The final Partner Center submission still depends on your chosen public installer URL and product metadata.
