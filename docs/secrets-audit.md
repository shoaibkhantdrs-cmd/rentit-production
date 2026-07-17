# RentIt — Secrets Audit

Read-only, repository-wide search for hardcoded/leaked credentials, across the full working tree, `node_modules` excluded, plus a check of git history (2 commits total). Every match is listed below — none were fixed or removed.

## Bottom line

No real third-party API key, JWT secret, private key, or password was found anywhere in the repository — tracked, untracked, or in git history. Every match below is one of: a real `.env` file present locally but never committed and containing only blank/placeholder values, a hardcoded **dev-only fallback default** already known from the prior security audit, a fake value used purely in unit/integration tests, or a placeholder shown in documentation. The one genuinely actionable item — the hardcoded JWT fallback secret — was already flagged as the #1 Critical finding in `docs/security-audit.md`; it's repeated here because it's a real "hardcoded value" match the user explicitly asked this audit to surface.

## 1. Real `.env` files present — not committed, contain no real secrets

| File | Tracked by git? | Contents |
|---|---|---|
| `.env` (root) | **No** — confirmed absent from `git ls-files` and from all of git history (`git log --all --full-history` on this path returns nothing) | Byte-identical to `.env.example`. Every third-party field (Cloudinary, Google Maps, SMTP, Twilio, Firebase, WhatsApp, Razorpay, Stripe, Sentry, metrics token) is blank. |
| `backend/.env` | **No** — same check, same result | All third-party fields blank; only differs from `backend/.env.example` in a CORS comment. |
| `frontend/.env` | Doesn't exist (only `frontend/.env.example`) | — |
| `.env.production.example` | Untracked (new file, not yet committed) but is itself an example file — every field blank by design | — |

`.gitignore` correctly lists `.env` and `.env.*`, with explicit allow-list exceptions for `.env.example` and `.env.*.example` — confirmed working as intended (`git ls-files` shows only the three `.example` files tracked, never a real `.env`).

## 2. Hardcoded fallback secrets in tracked source (the real finding)

| Value | Where | Risk |
|---|---|---|
| `dev-only-insecure-secret-change-me` | `backend/src/config/env.ts:56` (JWT access-token signing secret fallback) and `docker-compose.yml:38` (same value, as the shell-style `${JWT_ACCESS_SECRET:-dev-only-insecure-secret-change-me}` default) | **This is the one match in this audit with real exploit potential.** It's a hardcoded value the app will actually sign/verify tokens with if `JWT_ACCESS_SECRET` isn't set — see `docs/security-audit.md` Finding #1 (Critical) for the full attack scenario. |
| `rentit_dev_password` | `docker-compose.yml:10`, `backend/src/config/env.ts` (DB URL fallback), `.env`, `backend/.env`, `.env.example`, `backend/.env.example` | Dev-only Postgres password, same value everywhere by design, database not intended to be internet-reachable. Low risk but a real hardcoded credential nonetheless. |
| `change_me_before_production` | `docker-compose.yml:144` (`GF_SECURITY_ADMIN_PASSWORD` Grafana fallback) | Same category as above — a hardcoded default that's meant to be overridden, named so it's obvious if it isn't. Low risk (Grafana is typically not internet-exposed either), worth confirming it's actually overridden before any production deploy. |
| `ci-test-secret-not-used-in-production` | `.github/workflows/ci.yml:43` | CI-only, scoped to an ephemeral GitHub Actions runner and test database. Not exploitable outside the CI job. |
| `rentit_ci_password` | `.github/workflows/ci.yml:32,42` | Same — CI-only Postgres password for the ephemeral test DB spun up during the workflow run. |

## 3. Test-fixture secrets (fake values, used only inside test files)

| Value | File |
|---|---|
| `rzp_test_key`, `whsec_test_razorpay` | `backend/tests/unit/RazorpayPaymentGateway.test.ts` |
| `sk_test_123`, `whsec_test_stripe` | `backend/tests/unit/StripePaymentGateway.test.ts` |
| `whsec_test_razorpay`, `whsec_test_stripe` (same two, repeated) | `backend/docs/logs-src-phase6-part1-webhook-signature-algorithm.ts` — a saved log/output file documenting the webhook HMAC algorithm, not live code |
| `"Sup3rSecret!"`, `"OldPassword1"`, `"NewPassword1"`, `"abc12345"`, `"wrong-password"` | `backend/tests/integration/password-login-and-reset.test.ts` |
| `"correct horse battery staple"` | `backend/tests/integration/emails-on-register-and-approve.test.ts` |

None of these match real provider key formats at production length (e.g. `sk_test_123` is 3 characters after the prefix, not a real Stripe test key) — they're illustrative fixtures for unit-testing signature/auth logic.

## 4. Documentation placeholder

`docs/phase-5.md:329` shows the *format* a Firebase service-account private key should be pasted in:
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```
`MIIEvQ...` is truncated/illustrative, not real key material. This was the only `BEGIN ... PRIVATE KEY` match anywhere in the repository.

## 5. Provider-specific key formats searched — zero real matches found

Searched the full repository (tracked + untracked, `node_modules` excluded) for the following patterns; none matched a real-looking value anywhere, in the current tree or in git history:

- Stripe (`sk_live_`, `sk_test_`, `pk_live_`, `pk_test_`, `whsec_`) — only the test fixtures in section 3
- Razorpay (`rzp_live_`, `rzp_test_`) — only the test fixture in section 3
- AWS access key IDs (`AKIA...`) — none, including a full `git log -S"AKIA"` history search
- Google API keys (`AIza...`) — none
- OpenAI keys (`sk-...`) — none (this project doesn't integrate OpenAI)
- Anthropic keys (`sk-ant-...`) — none (this project doesn't integrate Anthropic)
- Twilio Account SIDs (`AC` + 32 hex chars) / auth tokens — none
- SendGrid keys (`SG.`) — none (this project doesn't use SendGrid; email is SMTP-based)
- Firebase — only the placeholder in section 4
- JWT-format tokens (`eyJ...`) hardcoded outside of runtime-generated values — none found

## 6. GitHub Actions — correct pattern, no leaked values

`.github/workflows/deploy.yml` references `${{ secrets.DEPLOY_HOST }}`, `${{ secrets.DEPLOY_USER }}`, `${{ secrets.DEPLOY_SSH_KEY }}`, `${{ secrets.DEPLOY_PATH }}`, and `${{ secrets.GITHUB_TOKEN }}` — all pulled from GitHub's encrypted secrets store at workflow run time, never hardcoded in the file itself. This is the correct pattern.

## 7. Git history

The repository has only **2 commits** total (`Phase 1: project architecture...` and `Phase 5: real-time chat...`) — the bulk of the working tree (all payment, security-hardening, deployment, and later-phase files) is currently uncommitted/untracked, not part of history yet. A `.env`-path history search and pickaxe searches (`git log -S`) for `AKIA`, `sk_live_`, `AIza`, and `BEGIN PRIVATE KEY` across all history returned no real matches. Nothing was found that was "accidentally committed then removed."

## Everything checked with no match at all

AWS keys, Google Maps keys, OpenAI keys, Anthropic keys, Twilio keys/tokens, Firebase keys (beyond the doc placeholder), SendGrid keys, private key files (`.pem`, `.key`), and any populated non-example `.env` file being tracked by git.
