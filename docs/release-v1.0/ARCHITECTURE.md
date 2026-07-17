# RentIt Architecture Documentation (v1.0)

## Overall shape

A monorepo with two independently deployable apps sharing nothing but an HTTP contract: `backend/` (Node.js/Express/TypeScript/PostgreSQL) and `frontend/` (React/Vite/TypeScript). No shared code package between them — the frontend's `src/api/types.ts` mirrors the backend's response shapes by convention, not by import, which is a deliberate simplicity choice at this project's size (a shared types package would need its own build/publish step for marginal benefit with two consumers).

## Backend: Clean Architecture, strictly layered

```
interfaces/    <- HTTP: routes, controllers, middleware, Zod validators
application/   <- use-cases: one class per operation, orchestrates domain + infrastructure via interfaces
domain/        <- entities, repository interfaces, service interfaces, domain errors. Zero external dependencies.
infrastructure/<- concrete implementations: Postgres repositories, JWT, bcrypt, Cloudinary, Razorpay/Stripe, WebSocket, SMTP, WhatsApp, Sentry, Prometheus metrics
container.ts   <- composition root: the ONLY file that imports concrete infrastructure classes directly
```

The dependency rule: arrows only point inward. `domain/` knows nothing about Express, Postgres, or any npm package — it's pure TypeScript interfaces and business entities. `application/` depends only on `domain/`'s interfaces, never on a concrete repository class. `infrastructure/` implements those interfaces. `interfaces/` (HTTP layer) calls use-cases, never repositories or infrastructure services directly. `container.ts` is where concrete classes get wired into interfaces and handed to controllers — swapping Postgres for a different database, or Twilio for a different SMS provider, means changing exactly one file.

This paid off directly during the Phase 6 production-readiness pass: the entire test suite (184 tests) runs against in-memory fake repositories (`tests/support/fakes/`) exercising the exact same use-case classes the real HTTP layer calls — not a parallel reimplementation of the business logic, the literal same code, See `tests/support/buildTestContainer.ts`'s doc comment.

## Hand-rolled infrastructure, by design

A deliberate, consistent pattern throughout: WebSocket framing (`infrastructure/realtime/`), JWT signing/verification (`infrastructure/security/JwtTokenService.ts`, HS256 via `node:crypto`), the SMTP client, Google/Razorpay/Stripe/WhatsApp/Twilio HTTP integrations (via native `fetch`, not vendor SDKs), response compression (`node:zlib`, not the `compression` package), and Prometheus metrics (hand-rolled exposition format, not `prom-client`). The reasoning, repeated at each site: when a Node built-in or a single well-documented HTTP API already does the job, a full SDK dependency adds surface area (version churn, transitive dependencies, unfamiliar abstractions) without proportionate benefit at this app's scale. This is a considered choice, not an accident — don't "fix" it by reintroducing a library at one of these sites without that trade-off in mind.

## Frontend

Standard React SPA: `pages/` (route-level components) → `components/` (shared UI) → `context/` (Auth, Theme, Chat providers) → `api/` (one file per backend resource, all going through a shared `httpClient` with token attachment/refresh and a small GET cache) → `hooks/`. Routing via `react-router-dom`; the `/admin` subtree is code-split via `React.lazy` (Part 3) since regular users never need that bundle. A hand-rolled service worker (Part 7) provides offline app-shell caching without a Workbox dependency.

## Real-time

`WebSocketGateway` (backend) holds an in-memory map of connected sockets per user, used for instant chat delivery alongside the REST API. This is the one piece of backend state that is NOT safely horizontally scalable as-is — see `docs/phase-6-part8-deployment-backend.md`'s "Statefulness and horizontal scaling" section before running more than one backend instance.

## Payments

Gateway-agnostic domain model: `payment_orders` (intent) → `payments` (confirmed charge) → `invoices`/`refunds`, with `purchasable_type`/`purchasable_id` polymorphically linking to either a `listing_boosts` or `user_subscriptions` row. `IPaymentGateway` is the interface both `RazorpayPaymentGateway` and `StripePaymentGateway` implement — adding a third gateway means one new class, no change to any use-case. Webhook signature verification (HMAC, `timingSafeEqual`) is what authenticates the two public webhook endpoints in place of a user session.

## Observability

Structured logging (pino) with request-scoped fields and secret redaction, a hand-rolled Prometheus `/metrics` endpoint (RED method: rate/errors/duration), an `IErrorTracker` abstraction (`NoOpErrorTracker` by default, `SentryErrorTracker` when `SENTRY_DSN` is set), and a two-tier health check (`/health` readiness vs `/health/live` liveness) — see `docs/phase-6-part4-observability.md` for the full reasoning behind each.

## Where to look for more detail

Each phase's own docs go deeper on the area it added: `docs/phase-2.md` through `phase-5.md` (root `docs/`) cover the original four build phases' domain design; `backend/docs/phase-6-part*.md` cover the production-readiness pass this release is built on.
