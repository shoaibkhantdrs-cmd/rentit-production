# Phase 6 Part 6 — CI/CD

## GitHub Actions

`.github/workflows/ci.yml` — three jobs, all defined in one file so `build-and-push` can cleanly depend on the other two via `needs:`:

- **backend**: lint, typecheck, then a real `npm run migrate:up` against a throwaway `postgres:16-alpine` service container (catches a broken/out-of-order migration before it ever reaches a real environment — a check that was previously only ever run manually in this sandbox, see task #42), then the actual test suite (`npm test` — unit + integration + e2e), then a production build.
- **frontend**: lint, typecheck, build.
- **build-and-push**: only runs on a push to `main` or a `v*` tag (never on a PR), and only after both jobs above pass. Builds both Dockerfiles' `prod` stage and pushes to GitHub Container Registry (`ghcr.io/<owner>/rentit-backend`, `rentit-frontend`), tagged with the short commit SHA always, plus `latest` on `main` and the exact version on a tag push.

`.github/workflows/deploy.yml` — manual (`workflow_dispatch`) deployment to a single Docker host over SSH: pulls the image tag you specify, runs `docker compose -f docker-compose.prod.yml up -d`, then verifies the new container actually answers `GET /health/live` before declaring success (so a broken image can't silently report a green deploy). Gated behind a GitHub Environment named `production`, which a repo owner can additionally configure to require manual approval before this job is allowed to run at all (Settings → Environments — not something committed in this file).

### Known gap: no committed lockfiles

`backend/package-lock.json` and `frontend/package-lock.json` don't exist in this repo — every phase of this build ran in a sandbox with no npm registry access, so `npm install` has never actually been run for real here. `ci.yml` uses `npm install` (not `npm ci`) and skips `actions/setup-node`'s dependency cache accordingly, both clearly commented as a stopgap. **Before relying on this pipeline for real:** run `npm install` in both `backend/` and `frontend/` on a machine with real npm access, commit the two resulting `package-lock.json` files, then switch both `ci.yml` jobs back to `npm ci` + `cache: npm` — faster and, more importantly, reproducible (a lockfile pins exact transitive versions; `npm install` without one can resolve a different dependency tree on every run).

## Docker production images

Both `backend/Dockerfile` and `frontend/Dockerfile` already had a multi-stage `prod` target from an earlier phase (dev dependencies + full source never ship in the production image; only compiled output + production-only `node_modules`). This pass hardened both:

- Added `HEALTHCHECK` (backend: `GET /health/live`, the liveness endpoint added in Part 4; frontend: `GET /` against `serve`) so an orchestrator can tell a running container apart from one that's up but not actually serving traffic.
- Added `USER node` — both stages previously ran as root (the base image's implicit default), the only user actually needed for either "run a compiled Node app" or "serve static files."

Neither could be built in this sandbox (no Docker available) — reviewed by hand for correctness rather than executed; flagged in Part 9's Final QA as something to build-and-run once in a real Docker environment before the first production deploy.

## Docker Compose production

`docker-compose.prod.yml` — a separate file from the dev `docker-compose.yml`, not an override layered on it (production differs in enough ways — no source volume mounts, `prod` build targets, monitoring always on, no dev-only fallback secrets — that a shared base ends up mostly prod-only sections anyway). Supports two deploy styles: build images locally from the `build:` blocks, or set `BACKEND_IMAGE`/`FRONTEND_IMAGE` to pull the exact tags `ci.yml` published to GHCR (what `deploy.yml` does). Includes Prometheus + Grafana as always-on services (unlike the dev compose file, where they're opt-in behind a Compose profile) — production is exactly when you want monitoring running by default.

## Environment separation

`.env.production.example` (root) — the production counterpart to `.env.example`. The key difference: nothing in `docker-compose.prod.yml`'s environment block has a baked-in fallback default the way the dev compose file's does (e.g. `${JWT_ACCESS_SECRET:-dev-only-insecure-secret-change-me}`) — every production value must be set explicitly in `.env.production`, so a misconfigured deploy fails loudly at container startup instead of silently running on a dev-only secret. `env.ts` already enforced this at the application level (throws if `JWT_ACCESS_SECRET` is unset when `NODE_ENV=production`); this makes the same discipline visible at the infrastructure level too.

**Fixed while writing this file: a real secrets-leak gap in `.gitignore`.** The previous env-file rules (`.env`, `.env.local`, `.env.*.local`) did not match a file literally named `.env.production` — only `.env.production.local` would have matched. That's the exact filename this doc and `docker-compose.prod.yml`'s usage comment tell an operator to create and fill with real secrets. Broadened to `.env.*` (with explicit `!.env.example` / `!.env.*.example` exceptions) so every real env file is caught regardless of suffix. Verified with `git check-ignore` against `.env`, `.env.production`, `.env.local` (all now correctly ignored) and `.env.example`, `.env.production.example`, `backend/.env.example` (all correctly still tracked).

## Deployment automation

Covered by `deploy.yml` above. What it deliberately does *not* do: provision the target host, install Docker on it, or create/rotate `.env.production` there — those are one-time setup steps for whichever hosting approach is chosen (see Part 8's deployment guides for the concrete options per service). Re-running `deploy.yml` against an already-provisioned host is the repeatable part this automates; getting to "an already-provisioned host" the first time is not something a GitHub Actions workflow alone can safely automate without knowing which cloud/provider is in play.
