# Phase 6 Part 8 — Deployment Guide: Backend

## Hosting options

**Managed container platforms** (Railway, Render, Fly.io) — point at `backend/Dockerfile`'s `prod` target, set the environment variables from `.env.production.example`, done. Least operational overhead; the recommended default for launch.

**Self-managed** (a VM or Kubernetes cluster running `docker-compose.prod.yml` or its images directly) — more control, more to operate: OS patching, Docker daemon updates, and the reverse-proxy/TLS-termination layer are now your responsibility rather than the platform's. Reasonable once traffic or compliance requirements justify it; unnecessary complexity before then.

Either way, the image to deploy is the one `.github/workflows/ci.yml`'s `build-and-push` job already publishes to `ghcr.io/<owner>/rentit-backend` (see `docs/phase-6-part6-cicd.md`) — no separate production build process to maintain outside CI.

## Statefulness and horizontal scaling

The HTTP API itself is stateless (JWT bearer auth, no server-side session store) and safe to run behind a load balancer across multiple instances with no sticky-session requirement — any instance can serve any request.

**One real exception: the WebSocket gateway** (`infrastructure/realtime/WebSocketGateway.ts`, Phase 5 — real-time chat delivery). Its connection state (which socket belongs to which user) is held in that process's memory, not shared across instances. Running more than one backend instance without addressing this means a chat message can be delivered to a user connected to instance A while the sender's request was handled by instance B, which has no way to reach that socket. Two ways to fix this, neither implemented in this codebase yet since it wasn't needed for a single-instance deploy: (1) sticky sessions at the load balancer (route a given user's WebSocket connection to the same instance every time — simplest, but reduces the benefit of horizontal scaling for that traffic), or (2) a shared pub/sub layer (Redis, most commonly) that every instance subscribes to, so any instance can publish a message and have it delivered regardless of which instance holds that user's actual socket. Needed before scaling the backend beyond one instance; not needed before that.

## Environment variables and secrets

Every variable in `.env.production.example` must be set via whatever secrets mechanism the hosting platform provides (platform-native secrets manager, Kubernetes Secrets, Docker Compose's `.env.production` file kept off-host-committed per Part 6) — never baked into the image itself. `env.ts` already throws at startup if `JWT_ACCESS_SECRET` is unset in production, which is a deliberate fail-fast: a backend that started successfully has, at minimum, that one check passed.

## Reverse proxy / TLS

Same story as the frontend: whatever terminates TLS in front of the backend (a platform's built-in load balancer, or a self-managed nginx/Caddy) must forward the real client IP via `X-Forwarded-For` — `app.ts` already sets `app.set("trust proxy", 1)`, which trusts exactly one proxy hop. If there's more than one hop between the client and this app (e.g. a CDN in front of a load balancer in front of the app), that number needs to change to match, or rate-limit keys and audit-log IPs will record the proxy's IP instead of the real client's.

## Database migrations on deploy

`npm run migrate:up` must run against the production database as part of every deploy that includes new migrations — it is **not** run automatically by the `prod` Docker image or by `docker-compose.prod.yml` on container start (deliberately: auto-running migrations on every container start is unsafe with more than one replica, since multiple instances starting simultaneously would race to apply the same migration). Run it once, from CI or manually, before rolling out the new backend image — `.github/workflows/ci.yml` already runs it against a throwaway Postgres as a correctness check, but that's a different database from production and doesn't apply anything there.

## Health checks

Point the hosting platform's health check at `GET /health` (readiness — checks the DB, takes the instance out of rotation if it's down) for load-balancer routing decisions, and at `GET /health/live` (liveness — no I/O) for restart decisions, per the distinction documented in Part 4. Using the wrong one for the wrong purpose (e.g. restarting on a DB blip) makes outages worse, not better.
