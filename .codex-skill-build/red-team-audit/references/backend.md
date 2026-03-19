# Backend Audit Checks

Read this when the implementation includes server logic, APIs, persistence, jobs, workers, queues, or infra integrations.

## API And Service Logic

- Check whether handlers validate input shape, size, enum values, and ownership before acting.
- Check whether partial failures leave side effects committed without compensation or visibility.
- Check whether error mapping preserves actionable detail without leaking sensitive internals.
- Check whether idempotency is defined for retries, webhooks, queues, and user-triggered resubmission.

## Persistence And Data Safety

- Check transaction boundaries and whether related writes can partially commit.
- Check upserts, deletes, cascades, and migrations for unintended scope.
- Check uniqueness, deduplication, and locking assumptions under concurrent requests.
- Check whether read-modify-write flows are race-safe.

## Async, Jobs, And External Calls

- Check retries, backoff, timeout, dead-letter, and cancellation behaviour.
- Check whether jobs are safe to run twice.
- Check whether queue consumers or schedulers can process the same work concurrently.
- Check whether external API failures degrade safely and observably.

## Security

- Check authentication, authorisation, tenancy boundaries, secret handling, and auditability of privileged actions.
- Check injection risks in SQL, NoSQL, templates, shells, file paths, and serialised payloads.
- Check SSRF, path traversal, unsafe deserialisation, and insecure file handling where relevant.

## Operations And Observability

- Check whether logs, metrics, and tracing distinguish retries, partial failure, and final failure.
- Check whether alerts, health checks, and startup validation would catch bad configuration or dependency loss.
- Check whether feature flags or fallback modes can mask broken behaviour indefinitely.
