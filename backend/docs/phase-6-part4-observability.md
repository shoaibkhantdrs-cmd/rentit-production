# Phase 6 Part 4 — Observability

Goal: make it possible to tell what a running production instance is doing, and get notified when it breaks, without needing to attach a debugger or read raw stdout logs by eye.

## Structured logging

Already in place before this pass (Phase 2) — `pino` via `pino-http`, with request-scoped fields (`requestId`, method, path, status, duration) attached to every log line, and secret redaction already configured in `infrastructure/logging/logger.ts` (JWT secrets, passwords, Authorization headers). No gap found here; this pass only added error-tracker calls alongside the existing `logger.error(...)` calls in `errorHandler.ts`, never replacing them — the structured logger remains the source of truth even when Sentry is also configured.

## Health endpoints

`GET /health` already existed (DB-backed readiness check — 503 if the database is unreachable). **Added:** `GET /health/live` — a pure liveness check with zero I/O, always 200 unless the Node process itself is wedged. This is the standard Kubernetes/orchestrator split: an orchestrator should route on the DB-backed check (if the DB drops, stop sending this instance traffic) but restart on the liveness check (if a broken DB caused a restart, the new instance would hit the exact same broken DB — restarting fixes nothing). Having only one endpoint conflates these two very different failure responses. See the doc comment on `getLiveness()` in `src/controllers/health.controller.ts`.

## Metrics / Prometheus

**Added: `GET /metrics`** (`src/infrastructure/observability/metrics.ts`, mounted in `app.ts`), a hand-rolled Prometheus text-exposition-format exporter — no `prom-client` dependency, consistent with this codebase's established pattern of hand-rolling infrastructure that a built-in (here: string formatting + `Map`s) already covers, rather than adding a library (see WebSocket framing, JWT, compression, SMTP client). Tracks the RED method: **R**ate (`rentit_http_requests_total`), **E**rrors (`rentit_http_responses_by_status_total`, broken out by status class), **D**uration (`rentit_http_request_duration_ms_sum` + a 10-bucket histogram), plus process-level uptime and memory. `metricsMiddleware()` is mounted globally in `app.ts` ahead of the router so it also captures 404s, not just matched routes.

Guarded by an optional shared bearer token (`METRICS_TOKEN`) — request-rate-by-route data is internal operational detail, not something to leave open on the public internet. Left open when the token is unset, matching this codebase's existing "safe default for local dev, explicit opt-in for the stricter production behavior" pattern (see `JWT_ACCESS_SECRET`).

Verified by simulating 4 requests through the real (not reimplemented) `metricsMiddleware()`/`renderMetrics()` and asserting on the rendered output — 6/6 checks passed. See `docs/logs/phase6-part4-metrics-verification.log`. One real bug caught and fixed during this verification: `metrics.ts` imported `{ NextFunction, Request, Response }` from `"express"` as a plain (non-type-only) import; correct under `tsc` but worth tightening to `import type` regardless.

## Grafana support

Added `monitoring/prometheus.yml` (scrape config pointed at the backend's `/metrics`), `monitoring/grafana/provisioning/datasources/prometheus.yml` (auto-provisions the Prometheus datasource, no manual click-through), `monitoring/grafana/provisioning/dashboards/dashboards.yml` + `monitoring/grafana/dashboards/rentit-backend.json` (a starter dashboard: request rate by route, error rate by status class, p95 latency via `histogram_quantile`, process memory, uptime). Wired into `docker-compose.yml` as `prometheus` + `grafana` services, gated behind an `observability` Compose profile so a plain `docker compose up` stays lightweight — bring them up with `docker compose --profile observability up`. All 4 new YAML/JSON files verified to parse correctly (`yaml.safe_load` / `json.load`).

## Error tracking (Sentry abstraction)

**Added:** `IErrorTracker` (`domain/services/IErrorTracker.ts`), following this codebase's existing pattern of interfaces for anything that talks to an external service (`IEmailService`, `IPushNotificationService`, `IHealthCheckService`). Two implementations:

- `NoOpErrorTracker` — the default. Routes exceptions through the existing structured logger (tagged `errorTracker: "noop"`) rather than doing nothing, so errors are never silently dropped even without Sentry configured.
- `SentryErrorTracker` — a fetch-based client against Sentry's plain HTTP Store API (`POST /api/<project_id>/store/`), rather than the `@sentry/node` SDK. Consistent with this codebase's hand-rolled-HTTP-client pattern (WhatsApp Cloud API, Razorpay/Stripe, Twilio) — the SDK does far more than this task asks for (breadcrumbs, session tracking, source map upload); this covers exactly "report an unhandled exception somewhere a human will see it." Fire-and-forget: a broken Sentry integration must never make the app slower or less available than having no error tracking at all, so send failures are caught and logged locally instead of thrown or awaited on the request path.

`container.ts` wires `SentryErrorTracker` only when `SENTRY_DSN` is set, otherwise `NoOpErrorTracker` — zero code change needed to turn on real error reporting, just set the env var. `errorHandler.ts` was changed from a bare function to `createErrorHandler(errorTracker)` (a factory, so the container can inject the right implementation) and now calls `errorTracker.captureException(...)` for every 5xx `AppError` and every truly unhandled error — but deliberately *not* for 4xx `AppError`s (validation failures, not-found, forbidden), since those are expected application flow, not incidents, and reporting every one of them would bury real signal in noise.

Verified against the real (not reimplemented) `SentryErrorTracker.ts` and `createErrorHandler()`, with `fetch` monkey-patched to inspect the outgoing payload instead of hitting the network: 7/7 checks on `SentryErrorTracker` (DSN parsing, auth header, event_id format, exception/tag/user fields) and 8/8 checks on `createErrorHandler` (5xx reports, 4xx does not report, unhandled errors report with status 500, correct response bodies/status codes in all three cases). See `docs/logs/phase6-part4-errortracking-verification.log`.

## New environment variables

`SENTRY_DSN`, `SENTRY_RELEASE`, `METRICS_TOKEN` — added to `backend/.env.example`, root `.env.example`, and `docker-compose.yml`'s `backend` service environment block. All optional; the app behaves correctly with every one left blank.

## Summary of what was added in this pass

1. `GET /health/live` — liveness check, separate from the existing DB-backed readiness check.
2. `GET /metrics` — hand-rolled Prometheus exporter, RED-method metrics, optional bearer-token guard.
3. Grafana/Prometheus support — scrape config, auto-provisioned datasource + starter dashboard, opt-in Compose profile.
4. `IErrorTracker` abstraction with `NoOpErrorTracker` (default) and `SentryErrorTracker` (fetch-based, activates when `SENTRY_DSN` is set), wired into `errorHandler.ts`'s 5xx/unhandled-error paths only.
5. Structured logging confirmed already correct from Phase 2 — no change needed beyond adding error-tracker calls alongside it.
