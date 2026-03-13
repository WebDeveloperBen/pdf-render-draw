# Google Play Android Release

This file covers Android phone and tablet release through `native-android-release.yml`.

## Current placeholder values

- Product name: `MetreMate`
- Bundle identifier base: `com.metremate.app`
- Suggested Android package name: `com.metremate.app.android`

Google Play uses one app listing for phone and tablet by default. The current plan assumes one shared Play listing and one `.aab` pipeline.

## What must exist before the first real release

- Google Play Console developer account
- Android app record in Play Console
- Play App Signing enabled
- Upload keystore created and stored securely
- Service account with Android Publisher API access and Play Console release permissions
- Completed Play listing setup:
  - app name
  - short description
  - full description
  - screenshots
  - feature graphic
  - privacy policy URL
  - data safety form
  - content rating
  - target audience

## GitHub secrets and vars required

Create these in the `google-play-production` environment:

Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Vars:

- `ANDROID_PACKAGE_NAME`

## Files in this repo that matter

- [native-android-release.yml](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/.github/workflows/native-android-release.yml)
- [tauri.android.json](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/release/tauri.android.json)
- [publish-google-play.mjs](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/scripts/release/publish-google-play.mjs)
- [gen/android](/Users/bensutherland/.codex/worktrees/d870/pdf-render-draw/apps/native/src-tauri/gen/android)

## First-time setup sequence

1. Generate and commit the Android shell:
   ```bash
   pnpm --filter @pdf-annotator/native exec tauri android init --ci --skip-targets-install
   ```
2. Decide whether `com.metremate.app.android` is the final package name.
3. Create the app in Play Console.
4. Create the release keystore and save the alias and passwords.
5. Enable Play App Signing.
6. Create a Google Cloud service account and give it Play Console release permissions.
7. Do the first upload manually in Play Console. This is still required before API-only publishing becomes reliable.
8. Add the secrets and `ANDROID_PACKAGE_NAME` to GitHub.
9. Run the Android workflow manually with `publish=false` or `dry_run=true`.

## What the workflow does

1. Materialises `release.keystore` and `keystore.properties` on the runner.
2. Builds a signed `.aab`.
3. Uploads the `.aab` to the selected Google Play track when publishing is enabled.

## What remains manual

- Initial Play Console bootstrap
- Store listing copy and screenshots
- Policy declarations and review responses
- Track promotion strategy

## Recommended next move

After `gen/android` is committed, Android is probably the simplest end-to-end store path to make real first.
