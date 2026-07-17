# RentIt Deployment Checklist (v1.0)

Work through in order. Each item links to the doc with full detail.

## Prerequisites

- [ ] Run a real `npm install` in `backend/` and `frontend/`, commit both `package-lock.json` files. (`backend/docs/phase-6-part6-cicd.md`, "Known gap")
- [ ] Re-run `tsc --noEmit` in both directories with real dependencies installed and confirm 0 errors (expected, per `backend/docs/logs/phase6-part9-typecheck-audit.log`'s triage).
- [ ] Run `npm test` for real in `backend/` and confirm 184/184 still pass with real dependencies.

## Provision infrastructure

- [ ] PostgreSQL — managed or self-hosted (`backend/docs/phase-6-part8-deployment-postgresql.md`).
- [ ] Backend hosting — container platform or self-managed (`phase-6-part8-deployment-backend.md`).
- [ ] Frontend hosting — static host or the Docker `prod` image (`phase-6-part8-deployment-frontend.md`).

## External services — obtain PRODUCTION credentials for each (never reuse dev credentials)

- [ ] Cloudinary (`phase-6-part8-deployment-cloudinary.md`) — check plan tier against expected listing-photo volume.
- [ ] Google Maps Geocoding API (`phase-6-part8-deployment-google-maps.md`) — restrict key to server IP + Geocoding API only.
- [ ] Firebase (Cloud Messaging) (`phase-6-part8-deployment-firebase.md`) — production service account; upload APNs key if shipping iOS push.
- [ ] WhatsApp Business Cloud API (`phase-6-part8-deployment-whatsapp.md`) — start Meta Business Verification early, it's not instant.
- [ ] SMTP provider (`phase-6-part8-deployment-smtp.md`) — set up SPF/DKIM/DMARC DNS records before launch, not after.
- [ ] Razorpay and/or Stripe — production API keys + webhook secrets, webhook URLs pointed at the real production domain.
- [ ] Sentry (optional) — set `SENTRY_DSN` if using error tracking.

## Configuration

- [ ] Copy `.env.production.example` → `.env.production`, fill in every value (none have a fallback default in `docker-compose.prod.yml` — that's intentional).
- [ ] Generate a real `JWT_ACCESS_SECRET` (64-byte random hex, command is in the example file).
- [ ] Set `CORS_ORIGIN` to the real frontend domain (must match exactly, including scheme).
- [ ] Set `METRICS_TOKEN` to a real random value.
- [ ] Set `GRAFANA_ADMIN_PASSWORD` to a real password.

## Database

- [ ] Run `npm run migrate:up` against the production database (once, before first traffic).
- [ ] Confirm `npm run backup:db` works against the production database and produces a valid, `pg_restore --list`-verified dump.
- [ ] Set up off-host replication for backups (S3/GCS/equivalent) — not optional, see `phase-6-part5-backup-recovery.md`.
- [ ] Schedule backups (cron/CI/orchestrator — `phase-6-part6-cicd.md`'s deploy.yml doesn't do this by itself).

## CI/CD

- [ ] Add GitHub repository secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` (for `deploy.yml`).
- [ ] Confirm `ci.yml` passes on `main` (lint, typecheck, migrate dry-run, tests, build).
- [ ] Confirm `build-and-push` published real images to `ghcr.io/<owner>/rentit-backend` and `rentit-frontend`.

## Observability

- [ ] Confirm `GET /health` and `GET /health/live` respond correctly from the deployed backend.
- [ ] Confirm `GET /metrics` requires the bearer token and Prometheus is scraping it successfully.
- [ ] Open Grafana, confirm the RentIt dashboard shows live data.

## Mobile (if shipping native apps this release)

- [ ] Run `npx cap add android` / `npx cap add ios` on a machine with real tooling (`backend/docs/phase-6-part7-mobile.md`).
- [ ] Replace the placeholder icon/splash with final designed assets, re-run `npm run cap:assets`.
- [ ] Complete store listing requirements (screenshots, privacy policy, content ratings) — out of scope for this codebase.

## Final checks

- [ ] Real Lighthouse PWA + accessibility audit in an actual browser against the deployed frontend.
- [ ] Manual smoke test: register, verify, search, list a property, message an owner, make a test payment (sandbox/test mode), refund it, check it appears correctly in admin.
