# RentIt Launch Checklist (v1.0)

Assumes `DEPLOYMENT_CHECKLIST.md` is fully complete. This is about the day of (and days around) going live, not infrastructure setup.

## T-minus 1 week

- [ ] Confirm Meta Business Verification (WhatsApp) has completed, or plan to launch without WhatsApp contact temporarily if it hasn't.
- [ ] Confirm SPF/DKIM/DMARC DNS records have propagated and send a real test email to a Gmail/Outlook address — check it lands in the inbox, not spam.
- [ ] Load-test or at least manually verify the payment flow end-to-end with each configured gateway in production/live mode with a real small-value transaction, then refund it.
- [ ] Confirm the on-call/monitoring setup: who gets paged if `/health` starts failing or Sentry reports a spike in errors.
- [ ] Take (and verify) a fresh production database backup.

## T-minus 1 day

- [ ] Freeze non-critical merges to `main`.
- [ ] Confirm the exact image tag to deploy (`sha-xxxxxxx` or a version tag) is the one that passed CI.
- [ ] Dry-run the deploy workflow against a staging environment if one exists.
- [ ] Confirm rollback plan: previous image tag noted, database migration rollback (`npm run migrate:down`) understood for any migration in this release that isn't purely additive.

## Launch day

- [ ] Run `deploy.yml` (or the manual deploy steps) against production.
- [ ] Confirm `GET /health` and `GET /health/live` are green immediately after deploy.
- [ ] Smoke test the real production URL: load the homepage, search, view a listing, log in.
- [ ] Watch Grafana/Sentry for the first hour of real traffic for anything unexpected (error rate spike, latency regression, unexpected 4xx/5xx pattern).
- [ ] Announce/enable whatever marketing or App Store listing was gated behind this launch.

## First week after launch

- [ ] Review real user signups/listings against expected onboarding funnel — is anything dropping off unexpectedly (e.g. verification codes not arriving)?
- [ ] Check Cloudinary/Google Maps/WhatsApp usage against free-tier limits with real traffic, not projections.
- [ ] Confirm the scheduled database backup actually ran and produced a valid file, not just that the cron job exists.
- [ ] Triage anything Sentry surfaced that wasn't caught in QA.
- [ ] Revisit `RELEASE_NOTES.md`'s "Known limitations" list — decide what (if anything) needs to move up the roadmap based on real usage.

## Rollback trigger conditions (decide these BEFORE launch day, not during an incident)

- [ ] Error rate above a defined threshold sustained for N minutes.
- [ ] Payment success rate drops below a defined threshold.
- [ ] Database connection pool exhaustion / health check failing.

If any trigger fires: redeploy the previous known-good image tag via `deploy.yml`'s `workflow_dispatch` input, and only then investigate root cause — restoring service comes first.
