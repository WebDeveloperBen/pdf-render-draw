# Frontend Audit Checks

Read this when the implementation includes browser code, UI flows, client-side state, or rendering logic.

## State And Interaction

- Check whether local UI state can diverge from server state, URL state, or cached query state.
- Check whether optimistic updates roll back correctly on failure.
- Check whether selection, drag state, pagination, filters, or modal state become stale after navigation or data refresh.
- Check whether debounced, deferred, or transitioned updates can commit out of order.

## Validation And Input Handling

- Check whether client validation differs from server validation in a way that causes false success or broken recovery.
- Check whether empty strings, whitespace-only values, pasted content, rapid double submits, and duplicate actions are handled.
- Check whether disabled, loading, and error states genuinely block duplicate or conflicting actions.

## Rendering And Data Flow

- Check key stability in rendered lists and whether reorder/removal can attach the wrong state to the wrong item.
- Check memoised or derived data for stale inputs and incorrect invalidation.
- Check whether transformed data loses IDs, ordering, units, or precision before display or submission.
- Check whether SSR-disabled or client-only code still guards browser-only APIs correctly.

## UX Integrity

- Check whether failures are surfaced clearly enough for recovery.
- Check whether loading states can get stuck, flicker, or falsely indicate success.
- Check whether permissions or feature flags are enforced only cosmetically in the UI.

## Frontend Security

- Check for XSS, unsafe HTML rendering, insecure message passing, token exposure in client logs, and overly broad data hydration.
- Check whether sensitive values appear in URLs, local storage, or analytics payloads.

