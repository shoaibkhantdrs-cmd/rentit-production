# RentIt Deployment Checklist — RC1

Work through in order. This extends `docs/release-v1.0/DEPLOYMENT_CHECKLIST.md` — infrastructure/external-service provisioning is unchanged from v1.0 and isn't repeated in full here; only what's new or specifically re-verified for RC1 is listed below, plus the full checklist inline for convenience.

## 0. RC1-specific — do these first

- [ ] Run a real `npm install` in `backend/` and `frontend/` and commit both `package-lock.json` files. Every verification below that's marked "blocked in build sandbox" depends on this — this build environment had no package-registry access for the entire RC1 cycle.
- [ ] Re-run `cd frontend && npx tsc -b --noEmit` with real dependencies installed — expected to be clean (it already is, apart from the missing-package errors that installing fixes).
- [ ] Re-run `cd frontend && npm run build` and confirm it completes; spot-check the output manifest for separate chunks for the Leaflet map and the Framer Motion animation engine (both were converted to lazy-loaded/code-split in RC1 — confirm they're not still inlined in the main bundle).
- [ ] Re-run `cd backend && npm run test:unit` with real dependencies installed and confirm all 31 test files pass. The RC1 build sandbox could not execute this at all (esbuild native-binary platform mismatch unrelated to any RC1 code change) — this has not been run for real this cycle.
- [ ] Run the two new migrations against a real (staging) Postgres instance and confirm they apply cleanly: `1700000000044_add-trigram-indexes-for-ilike-search.js`, `1700000000045_add-notify-on-match-index-to-saved-searches.js`. Both are additive-only (new indexes, `CREATE EXTENSION IF NOT EXISTS pg_trgm`) with no data migration, so they're low-risk, but have not been run against a live database in this cycle.
- [ ] Manually smoke-test Framer Motion animations in a real browser (page transitions, toast enter/exit, card hover/drag-to-favorite, accordion open/close, filter drawer, popovers) — the `motion`→`m`/`LazyMotion` conversion done in RC1 has only been verified by static analysis (ESLint + reading the actual Framer Motion `strict`-mode semantics), never rendered in a browser.
- [ ] Tag this commit as the RC1 point once the above are green, e.g. `git tag rc1 && git push --tags`, so "feature freeze" has a concrete, referenceable marker. From this tag forward, only Critical/High bug fixes should land until final release.

## 1. Prerequisites (from v1.0, still applies)

- [ ] Confirm `tsc --noEmit` is 0 errors in both `backend/` and `frontend/` with real dependencies installed.
- [ ] Confirm `npx eslint src --ext ts,tsx --max-warnings 0` is clean in `frontend/` (already confirmed clean in the RC1 build sandbox; re-confirm after `npm install`).

## 2. Provision infrastructure (unchanged since v1.0)

- [ ] PostgreSQL — managed or self-hosted.
- [ ] Backend hosting — container platform or self-managed.
- [ ] Frontend hosting — static host or the Docker `prod` image.

## 3. External services — obtain PRODUCTION credentials for each (never reuse dev credentials)

- [ ] Cloudinary — check plan tier against expected listing-photo volume. RC1 added delivery-time transforms (`w_`/`c_fill`/`q_auto`/`f_auto`) to every property-image render site, which changes the transform mix Cloudinary bills against — worth a quick check against your plan's transform quota.
- [ ] Google Maps Geocoding API — restrict key to server IP + Geocoding API only.
- [ ] Firebase (Cloud Messaging) — production service account; upload APNs key if shipping iOS push.
- [ ] WhatsApp Business Cloud API — start Meta Business Verification early, it's not instant.
- [ ] SMTP provider — set up SPF/DKIM/DMARC DNS records before launch, not after.
- [ ] Razorpay and/or Stripe — production API keys + webhook secrets, webhook URLs pointed at the real production domain. (Untouched by RC1 — no payment code changed this cycle.)
- [ ] Sentry (optional) — set `SENTRY_DSN` if using error tracking.

## 4. Configuration

- [ ] Copy `.env.production.example` → `.env.production`, fill in every value.
- [ ] Generate a real `JWT_ACCESS_SECRET` (64-byte random hex). RC1 tightened the boot guard so this is now required whenever `NODE_ENV` isn't `development` (previously only enforced for `NODE_ENV=production` exactly) — double-check staging/CI environment configs set this too, or they'll now fail to boot where they previously started silently insecure.
- [ ] Set `CORS_ORIGIN` to the real frontend domain (must match exactly, including scheme).
- [ ] Set `METRICS_TOKEN` to a real random value.
- [ ] Set `GRAFANA_ADMIN_PASSWORD` to a real password.

## 5. Database

- [ ] Run `npm run migrate:up` against the production database, including the two new RC1 migrations (item 0 above should already have staging-verified these).
- [ ] Confirm `npm run backup:db` still works and produces a valid, `pg_restore --list`-verified dump.
- [ ] Confirm off-host backup replication is still running.

## 6. CI/CD

- [ ] Confirm `ci.yml` passes on `main`/`master` (lint, typecheck, migrate dry-run, tests, build) against this RC1 commit.
- [ ] Confirm `build-and-push` publishes updated images to `ghcr.io/<owner>/rentit-backend` and `rentit-frontend`.

## 7. Observability

- [ ] Confirm `GET /health` and `GET /health/live` respond correctly from the deployed backend.
- [ ] Confirm `GET /metrics` requires the bearer token and Prometheus is scraping it successfully.
- [ ] Open Grafana, confirm the RentIt dashboard shows live data — check the admin analytics/growth-chart panels specifically, since RC1 changed that query's date bounds.

## 8. Final checks

- [ ] Real Lighthouse PWA + accessibility audit in an actual browser against the deployed frontend.
- [ ] Manual regression smoke test across every area touched this cycle: sign in/out, list a property (as owner, non-admin — confirm it lands in review rather than publishing directly, per RC1's authorization fix), browse Search (type in city/locality and confirm results update after a short pause, not per keystroke; switch to Map view and confirm it loads), open a property's photo gallery, favorite/unfavorite a few properties from a grid, open Messages and send a message while another filter/page is open elsewhere, check the admin dashboard's growth chart and Users search, and confirm push/email notifications still fire on a saved-search match.
- [ ] Manual payment smoke test (sandbox/test mode): make a test payment, refund it, confirm it appears correctly in admin. (Unchanged by RC1, but part of every release's final check.)
