# Testing Strategy

This app uses a layered test strategy so we keep confidence high without turning every change into a full end-to-end exercise.

## Minimum bar for new work

- New server routes in `server/api/**` should ship with at least one integration test in `server/tests/suites/**`.
- New shared business composables in `app/composables/**` should ship with a Vitest spec when they branch on auth, billing, permissions, navigation, or API state.
- New stateful pages in `app/pages/**` should ship with either:
  - a page/component spec for their main conditional behaviour, or
  - a browser test when the value is in the full user flow rather than the component logic.
- Changes to built-runtime behaviour should add or update the prod smoke suite.

## Test layers

### 1. Unit and component tests

Use these for:

- composables
- feature gating
- billing and auth UI branching
- upload validation
- small reusable widgets

These should stay fast and mostly rely on mocked boundaries.

### 2. Server integration tests

Use these for:

- request validation
- auth and permission enforcement
- database side effects
- audit-log writes
- billing and upload route behaviour

These run against Nuxt's dev server with Testcontainers Postgres so route handlers execute against a real database.

### 3. Prod smoke tests

Use these for:

- the built Cloudflare worker output
- runtime wiring that can differ from Nuxt dev
- a small number of critical authenticated and unauthenticated routes

Keep these intentionally small. They are for build/runtime parity, not broad business coverage.

### 4. Browser tests

Use these sparingly for:

- multi-step page flows
- auth redirects
- onboarding
- project/share workflows
- admin operations where the UI flow itself is high risk

Prefer a few stable user-journey tests over lots of brittle click scripts.

## Practical rule of thumb

- If a regression would mostly break logic, add a unit or integration test.
- If a regression would mostly break wiring between multiple screens or browser-only behaviour, add a browser test.
- If a regression would only appear after Nitro bundles the app, add or extend the prod smoke suite.
