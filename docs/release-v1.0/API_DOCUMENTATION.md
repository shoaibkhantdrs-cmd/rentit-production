# RentIt API Documentation (v1.0)

Base URL: `https://<your-backend-domain>/api` (or `http://localhost:4000/api` in dev — see `backend/src/app.ts`, everything is mounted under `/`, itself typically reverse-proxied at `/api`).

Auth: `Authorization: Bearer <accessToken>` (JWT, HS256). Obtain via `/auth/login` or `/auth/verify-otp`. Endpoints marked **public** need no token; everything else does. Endpoints marked **admin** additionally require the `admin` or `super_admin` role.

All error responses share one shape: `{ "error": { "code": "...", "message": "...", "details": ... }, "requestId": "..." }`.

## Auth (`/auth`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/register` | public | Rate-limited. Creates account, sends verification codes. |
| POST | `/login` | public | Rate-limited. Password or OTP-required flow depending on account state. |
| POST | `/verify-otp` | public | Confirms a code sent for email/phone verification or OTP login. |
| POST | `/refresh` | public (refresh token) | Rotates the refresh token; reuse of an old one revokes the session. |
| POST | `/logout` | public (refresh token) | Revokes one session. |
| POST | `/logout-all` | required | Revokes every session for the current user. |
| POST | `/forgot-password` | public | Rate-limited. |
| POST | `/reset-password` | public | Consumes the reset code. |

## Users (`/users`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/me` | required | Current user profile + roles + preferences. |
| PATCH | `/me` | required | Update profile fields. |
| DELETE | `/me` | required | Account deletion. |
| POST | `/:id/report` | required | Report another user. |

## Notifications (`/notifications`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | required | Paginated list. |
| PATCH | `/read` | required | Mark notifications read. |
| POST | `/device-token` | required | Register an FCM device token. |
| GET | `/preferences` | required | Per-channel notification preferences. |
| PATCH | `/preferences` | required | Update preferences. |

## Properties (`/properties`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/mine` | required | Listings owned by the current user. |
| GET | `/favorites` | required | Current user's favorited listings. |
| GET | `/categories` | public | Cached 5 min. |
| GET | `/recently-viewed` | required | |
| GET | `/recommendations` | optional | Personalized if authenticated, generic otherwise. |
| GET | `/` | public (optional auth) | Search — filters, pagination, distance sort. |
| POST | `/` | required | Create a listing. |
| GET | `/:id` | public (optional auth) | Detail view; increments view count. |
| PATCH | `/:id` | required (owner) | |
| DELETE | `/:id` | required (owner) | |
| POST | `/:id/images` | required (owner) | Multipart upload, proxied to Cloudinary. |
| DELETE | `/:id/images/:imageId` | required (owner) | |
| POST | `/:id/favorite` | required | |
| DELETE | `/:id/favorite` | required | |
| POST | `/:id/report` | required | |
| GET | `/:id/recommendations` | public (optional auth) | Similar listings. |
| POST | `/:id/boost` | required (owner) | See Payments — creates a boost order. |

## Verification (`/verification`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | required | Submit identity verification documents. |
| GET | `/status` | required | |

## Chat (`/chat`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/unread-count` | required | |
| GET | `/conversations` | required | |
| POST | `/conversations` | required | Rate-limited. Starts (or reuses) a conversation. |
| GET | `/conversations/:id/messages` | required | Paginated. |
| POST | `/conversations/:id/messages` | required | Rate-limited. Also delivered over WebSocket to the recipient if connected. |
| POST | `/conversations/:id/read` | required | |
| DELETE | `/conversations/:id/messages/:messageId` | required (sender) | |

WebSocket endpoint: same host, upgrade handshake handled by `WebSocketGateway` — see `docs/phase-6-part8-deployment-backend.md`'s note on horizontal scaling before running more than one backend instance.

## WhatsApp (`/whatsapp`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/contact-owner` | required | Rate-limited. |
| POST | `/inquiry` | required | Rate-limited. |
| POST | `/share` | **public** | Rate-limited — deliberately unauthenticated (sharing a listing link), see Part 2 security audit. |

## Saved Searches (`/saved-searches`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | required | |
| POST | `/` | required | |
| PATCH | `/:id` | required (owner) | |
| DELETE | `/:id` | required (owner) | |

## Payments (`/payments`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/config` | public | Publishable keys (Razorpay key ID, Stripe publishable key). Cached 5 min. |
| GET | `/plans` | public | Premium plan catalog. Cached 1 min. |
| POST | `/listing-boosts` | required (owner) | Rate-limited (10/10min). Creates a gateway order. |
| POST | `/subscriptions` | required | Rate-limited (10/10min). |
| GET | `/history` | required | |
| GET | `/invoices` | required | |
| GET | `/invoices/:id` | required (owner) | |

## Webhooks (`/webhooks`) — unauthenticated by design, HMAC-verified

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/razorpay` | signature | Rate-limited (IP-keyed, 120/min). |
| POST | `/stripe` | signature | Rate-limited (IP-keyed, 120/min). |

## Health & Observability

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | Readiness — checks the database. |
| GET | `/health/live` | public | Liveness — no I/O. |
| GET | `/metrics` | optional bearer token (`METRICS_TOKEN`) | Prometheus text exposition format. |

## Admin (`/admin`) — every route requires `authenticate` + `authorize("admin", "super_admin")`

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/stats` | |
| GET | `/system/health` | Richer than the public `/health`. |
| GET | `/analytics/growth` | |
| GET | `/analytics/top-properties` | |
| GET | `/users` | Search/filter. |
| GET | `/users/:id` | |
| GET | `/users/:id/activity` | |
| PATCH | `/users/:id/status` | Suspend/ban/reactivate. |
| DELETE | `/users/:id` | |
| POST | `/users/:id/reset-password` | |
| PUT | `/users/:id/roles` | |
| GET | `/properties` | Moderation queue. |
| GET | `/properties/moderation-history` | |
| POST | `/properties/bulk-moderate` | |
| GET | `/properties/:id/moderation-history` | |
| POST | `/properties/:id/approve` \| `/reject` \| `/hide` \| `/unhide` \| `/feature` \| `/unfeature` | |
| GET | `/reports/properties` \| `/reports/users` | |
| PATCH | `/reports/properties/:id/status` \| `/reports/users/:id/status` | |
| GET | `/verification` | Pending queue. |
| POST | `/verification/:id/approve` \| `/reject` | |
| POST | `/notifications/broadcast` | |
| GET | `/audit-logs` | |
| GET | `/payments` | |
| GET | `/payments/:id/refunds` | |
| POST | `/payments/:id/refund` | |

For exact request/response bodies, see each route's Zod schema in `backend/src/interfaces/http/validators/` and the corresponding controller in `backend/src/interfaces/http/controllers/` — those are the source of truth and were kept in sync throughout every phase of this build.
