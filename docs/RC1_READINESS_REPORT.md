# RentIt — RC1 Readiness Report

**Review type:** Read-only. No application code was modified to produce this report.
**Scope reviewed:** `RELEASE_NOTES.md` (root, RC1), `docs/release-v1.0/RELEASE_NOTES.md` (v1.0 baseline — no single `release-v1.0.md` file exists in the repo), `docs/security-audit.md`, `docs/qa-full-bug-report.md`, `docs/rc1-bug-report.md`, `docs/phase-6-audit.md`, cross-checked against the current on-disk source (`backend/src`, `frontend/src`, migrations, Docker/env files).
**Base:** git `master`, last commit `c3e9e77` (2026-07-12).

## Remaining blockers (if any)

**No blocking code defects were found.** Every Critical bug and every High-severity security finding traced from the source documents is resolved in the current source, verified directly against the file and line the finding cited:

- **Critical (security-audit.md #1) — JWT secret fail-open on non-exact `"production"` match.** `backend/src/config/env.ts:32-36` now throws unless `NODE_ENV === "development"`, closing the gap for unset/mistyped/staging environments. Confirmed fixed.
- **Critical (qa-full-bug-report.md #1) — mobile Search filters panel unclosable overlay.** `frontend/src/index.css:2825-2841` now hides `.filters-v2` at `max-width: 900px` and shows the `Drawer`-based mobile filter UI (`SearchPage.tsx:747`) instead. Confirmed fixed.
- **Critical (qa-full-bug-report.md #2) — "Sign in" CTA routed to `/search`, a page with no login form.** `frontend/src/components/Layout.tsx:165` now routes to `/profile`, the actual `RequireAuth`-gated route that renders `AuthPanel` for a signed-out visitor. Confirmed fixed.
- **High (security-audit.md #2) — property owners could self-publish/un-hide listings, bypassing moderation.** `backend/src/application/properties/UpdateProperty.usecase.ts:94-120` now blocks non-admin callers from setting `status: "published"` or reversing an admin-applied `"inactive"`. Confirmed fixed.
- **High (qa-full-bug-report.md #3–#10)** — busy-state/race-condition/error-handling bugs across `SavedSearchesPage`, `AddPropertyPage`, `ConversationThreadPage`, `HomePage`, `PaymentHistoryPage` — recorded as fixed by the dedicated QA fix pass, with a final combined `tsc`/eslint verification pass logged as clean. Not independently re-diffed line-by-line in this review; flagged in Risks below as a documentation-trust item rather than a blocker, since the fix pass's own final verification was a real, run command (not a static claim).

No unfinished `TODO`/`FIXME`/`XXX` markers exist in production code. `backend/src` returned zero matches; `frontend/src` returned one substring hit that is not a marker — it's the `+91XXXXXXXXXX` placeholder string in `PropertyDetailsPage.tsx:235`, matching on the letters "XXX", not a `TODO`/`FIXME` comment. This is consistent with `phase-6-audit.md`'s own finding of zero placeholders in `backend/src`.

No broken routes exist. Every route in `frontend/src/App.tsx` resolves to a real (eager or `React.lazy`) page component, including the `/admin` subtree. Every backend route file (`auth`, `property`, `notification`, `chat`, `admin`, `webhook`, `payment`, `savedsearch`, `whatsapp`, `user`, `verification`) was cross-checked against its frontend `api/*.ts` caller for matching HTTP method and path — no mismatches found. The one historical mismatch (`admin.routes.ts`'s `PUT /admin/users/:id/roles` vs. a `PATCH` frontend call) is confirmed already fixed: both sides now agree on `PUT` (`admin.routes.ts:111`, `api/admin.ts:63`).

No missing environment variables. Every key `backend/src/config/env.ts` reads (`CLOUDINARY_*`, `GOOGLE_MAPS_API_KEY`, `SMTP_*`, `TWILIO_*`, `FIREBASE_*`, `WHATSAPP_*`, `RAZORPAY_*`, `STRIPE_*`, `SENTRY_*`, `METRICS_TOKEN`, all JWT/rate-limit/payment tuning vars) is present in `.env.production.example`, which is explicit-value-only (no baked-in defaults in `docker-compose.prod.yml`, so a misconfigured deploy fails loudly instead of silently running on a dev fallback).

No missing production configuration. `docker-compose.prod.yml`'s `backend` service loads the full `.env.production` via `env_file:` (not an itemized list, which is what caused the Phase-6-era bug where new Phase 3/5 variables were silently dropped — that bug is now structurally impossible, since `env_file` forwards everything) and separately overrides only `NODE_ENV`/`DATABASE_URL` as needed for the container network. `VITE_API_BASE_URL` is correctly wired as a frontend build arg, not a runtime env var, matching how Vite actually bakes it in.

## Risks

- **Nothing in this codebase has been run for real since before this review** (carried over from every prior audit in this project): no real `npm install` has ever been performed in this sandbox for either `backend/` or `frontend/`, so there are no committed lockfiles, the frontend production build (`tsc -b && vite build`) has never fully completed, and the backend's real test runner has never executed here (blocked by an `esbuild` native-binary platform mismatch specific to this sandbox). `docs/phase-6-audit.md` did get a real backend test run once, in its own sandbox session, at 169/169 passing — but that was before the RC1 design-refresh and QA-fix code landed, so it does not cover the current source tree. **This is the single largest source of risk going into RC1**: the code has been reviewed exhaustively but not executed end-to-end.
- **Two new database migrations (trigram indexes, saved-search partial index) have never run against a live Postgres.** Both are additive-only (`CREATE INDEX`, no table rewrites), so the risk is low, but "additive in the SQL" and "confirmed working on real data volumes" are different guarantees.
- **Framer Motion animations have not been visually confirmed** in a real browser — the `LazyMotion`/`strict`-removal fix is verified by API-contract reasoning (documented in `RELEASE_NOTES.md`), not by seeing it render.
- **Five Medium-severity security findings from `security-audit.md` remain open, not required for this review but worth carrying forward:** OTP codes can leak to plaintext logs if SMTP/SMS are left unconfigured in production (#3); Razorpay/Stripe webhook secrets have no production-required guard the way `JWT_ACCESS_SECRET` does, so an unset webhook secret degrades to a forgeable empty-string HMAC key (#4); identity-verification documents sit on public (if unguessable) Cloudinary URLs rather than authenticated ones (#5); the rate limiter is in-process memory only, so it resets on every restart and doesn't hold across horizontally-scaled instances (#6); and admin-only bulk-moderation/role-change/refund endpoints have no rate limiting beyond the role check itself (#7). None of these are Critical or High, and none block RC1 per the review's own severity bar, but items #4 and #6 in particular are the kind of gap that's cheap to close before a real production launch (see `security-audit.md`'s own "Suggested remediation order").
- **No real browser/Lighthouse/axe accessibility or performance audit has ever been run** on this project, RC1 included — every verification pass has been static (`tsc`, `eslint`, code-path tracing) or an in-memory-fake-backed unit test run, not a live click-through.
- **High #3–#10 QA fixes (busy states/race conditions across five pages) were trusted from `docs/rc1-bug-report.md`'s and the task history's own final-verification claim rather than independently re-diffed line-by-line in this review.** The final `tsc`/eslint clean pass they cite is a real, checkable claim (not a static assertion), which is why this is listed as a risk rather than a blocker — but a fresh pair of eyes clicking through those five pages before shipping would remove any doubt.

## Go / No-Go recommendation

**Conditional GO.**

No Critical bug and no High-severity security issue is open in the current source — every one traced from the six source documents has a corresponding, verified fix at the exact file/line the finding named. No unfinished TODOs, no broken routes, no missing environment variables, and no missing production configuration were found.

The condition: this codebase has never been executed end-to-end in any environment (no real `npm install`, no real production build, no real test run, no live database, no live browser). That is a sandbox limitation carried through every phase of this project, not a defect discovered in this review — but "ready to ship" still requires clearing the "Section 0" real-environment steps in `DEPLOYMENT_CHECKLIST.md` before RC1 goes to production. Treat this as code-complete and review-complete, not yet deploy-verified.

## Release checklist

- [x] Every Critical bug resolved (2 of 2: JWT secret fail-open, mobile filters overlay) — plus the QA report's "Sign in" dead-link, tracked as Critical in that report.
- [x] Every High-severity security issue resolved or documented (1 of 1: property self-publish bypass — resolved; 5 Medium-severity items remain, explicitly documented above, not required to block RC1).
- [x] No unfinished TODOs in production code (`backend/src`, `frontend/src` both clean).
- [x] No broken routes (frontend router, backend routes, and every `api/*.ts` call cross-checked).
- [x] No missing environment variables (`.env.production.example` covers every `env.ts` field).
- [x] No missing production configuration (`docker-compose.prod.yml`, both Dockerfiles reviewed and consistent).
- [ ] Real `npm install` run in `backend/` and `frontend/`; lockfiles committed.
- [ ] Real `tsc`/`eslint`/`npm run build` run to completion in both packages (not just filtered/partial passes).
- [ ] Real backend test run (`npm run test:unit` or equivalent) against the current RC1 source tree.
- [ ] Tag the reviewed commit as `rc1` once the above are green.

## Production deployment checklist

- [ ] Run the two new migrations (trigram indexes, saved-search partial index) against a staging Postgres instance; confirm no errors and expected index creation.
- [ ] Manually smoke-test Framer Motion interactions (page transitions, `AddPropertyPage`, `Modal`) in a real browser — confirms the `LazyMotion` `strict`-removal fix renders as expected.
- [ ] Fill in `.env.production` from `.env.production.example` with real secrets (never commit); generate `JWT_ACCESS_SECRET` via the documented `crypto.randomBytes` command.
- [ ] Set real `RAZORPAY_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET` before going live — these have no production-required guard, so an unset value silently downgrades webhook verification (security-audit.md Finding #4).
- [ ] Configure real SMTP/Twilio credentials before launch, or confirm the console fallback's OTP-in-logs behavior (security-audit.md Finding #3) is acceptable for the launch window.
- [ ] Deploy via `docker compose -f docker-compose.prod.yml --env-file .env.production up -d` (or the Railway/Vercel path in `PRODUCTION_DEPLOYMENT_GUIDE.md`); confirm `backend`'s healthcheck (`/health/live`) passes before routing traffic.
- [ ] Confirm `VITE_API_BASE_URL` is set as a frontend **build arg**, not a runtime env var — it's baked into the static bundle at build time.
- [ ] Point DNS/HTTPS at the real domain; confirm `CORS_ORIGIN` matches it exactly (no wildcard).
- [ ] Run a real Lighthouse/axe pass and a manual click-through of the core flows (auth, search, list-property, chat, payments, admin moderation) before announcing launch.
- [ ] Set `METRICS_TOKEN` and confirm `GET /metrics` requires it — it's open by default if left unset.
- [ ] After go-live, watch the in-process rate limiter (security-audit.md Finding #6) if running more than one backend instance — it does not share state across instances or survive restarts.
