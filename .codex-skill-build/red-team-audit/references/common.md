# Common Audit Checks

Use this reference on every audit. Treat it as a prompt for targeted inspection, not a template to dump verbatim.

## Correctness

- Check boundary conditions: empty input, singleton input, duplicate items, nullish values, whitespace-only strings, zero, negative values, and very large inputs.
- Check ordering and pairing integrity after sorting, mapping, filtering, grouping, pagination, normalisation, and deduplication.
- Check whether fallback behaviour silently returns stale, partial, or identity output instead of failing loudly enough.
- Check whether numeric calculations can overflow, underflow, divide by zero, lose precision, or invert intended ordering.

## Contract Handling

- Validate assumptions about request and response shapes.
- Check whether partial results, missing fields, unexpected enum values, and version drift are handled.
- Check whether retries, timeouts, backoff, and cancellation exist where external dependencies can hang or flap.
- Check whether sensitive config, tokens, or internal details can leak through logs, errors, analytics, or client payloads.

## State And Data Integrity

- Follow identifiers, ownership, and ordering through every transformation.
- Check whether caches, optimistic updates, local mirrors, or derived state can drift from the source of truth.
- Check whether concurrent writes, duplicate submissions, or retries can create inconsistent state.
- Check whether deletes, replacements, or merges are scoped correctly and idempotent.

## Performance And Resource Use

- Look for unnecessary full-list scans, repeated expensive work, blocking calls on hot paths, and unbounded fan-out.
- Check whether large payloads, nested loops, or repeated rendering work scale poorly.
- Check whether memory grows with retained listeners, unreleased buffers, cached results, or forgotten cleanup.

## Security And Abuse

- Check trust boundaries and whether untrusted input reaches file systems, shells, queries, templates, HTML, logs, or privileged APIs.
- Check authn/authz on read, write, and destructive paths.
- Check rate limiting, replay resistance, CSRF, SSRF, injection, path traversal, XSS, and secret handling when relevant.

## Testing Gaps

- Flag missing tests for high-risk branches, failure modes, retries, race conditions, and data migration or persistence edges.
- Flag tests that only cover happy paths when the implementation depends on nuanced failure handling.

