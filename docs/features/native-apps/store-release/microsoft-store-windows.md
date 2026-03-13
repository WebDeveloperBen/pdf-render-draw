# Microsoft Store Windows Release

This file covers Windows distribution through `native-windows-release.yml`.

## Current placeholder values

- Product name: `MetreMate`
- Bundle identifier base: `com.metremate.app`
- Suggested Windows product identity: keep `MetreMate` as the display name and manage the actual Store identity in Partner Center

The current implementation uses the EXE/MSI app path in Microsoft Store rather than an MSIX packaging track.

## What must exist before the first real release

- Microsoft Partner Center developer account
- Reserved product name in Partner Center
- EXE/MSI app configured in Partner Center
- Windows code-signing certificate exported as `.pfx`
- Public HTTPS hosting strategy for the signed MSI
- Completed Store listing setup:
  - app description
  - support URL
  - privacy policy URL
  - screenshots
  - age ratings
  - pricing or distribution settings

## GitHub secrets required

Create these in the `windows-production` environment:

- `WINDOWS_CERTIFICATE_PFX_BASE64`
- `WINDOWS_CERTIFICATE_PASSWORD`

## Files in this repo that matter

- [native-windows-release.yml](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/.github/workflows/native-windows-release.yml)
- [tauri.windows.json](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/release/tauri.windows.json)
- [tauri.conf.json](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/src-tauri/tauri.conf.json)

## First-time setup sequence

1. Create the Partner Center account.
2. Reserve the final product name.
3. Decide where the signed MSI will live publicly.
4. Export the Windows signing certificate as `.pfx`.
5. Add the certificate secrets to GitHub.
6. Run the Windows workflow manually with `publish=false` or `dry_run=true`.
7. Once you have a stable public MSI URL, wire the final Partner Center submission API step if you want full automation.

## What the workflow does today

1. Builds an MSI from the Tauri app.
2. Signs the MSI with `signtool`.
3. Uploads the MSI as a GitHub Actions artefact.
4. Attaches the MSI to the GitHub release for tagged builds.

## What is still manual by design

- Hosting the public MSI at a stable production URL
- Creating the final Partner Center submission that references that URL
- Managing Store listing metadata and certification feedback

## Recommended next move

Treat Windows as the third store to finish, not the first. The pipeline is largely there already, but the last mile depends on the hosting model you choose for the installer.
