# Phase 6 — Production Readiness Audit, Fixes, and Deployment Runbook

## Verification logs (§0a)

Every claim in §0 below was re-verified with real commands, not assumed,
and each run's full output is saved under `docs/logs/`:

| Log file | What it proves |
|---|---|
| `logs/phase2-backend-npm-install.log` | `npm install` in `backend/` -- real attempt, exit 1, `E403` from `registry.npmjs.org` |
| `logs/phase2-frontend-npm-install.log` | Same, `frontend/` -- exit 1, `E403` |
| `logs/phase3-backend-syntax-check.log` | `transpileModule` syntax check, 334 backend files, 1 pre-existing false positive |
| `logs/phase3-frontend-syntax-check.log` | Same, 63 frontend files, 1 pre-existing false positive |
| `logs/phase3-lint-format-attempt.log` | `npx eslint --version` / `npx prettier --version` -- both `E403`, confirming lint/format can't run without a real registry either |
| `logs/phase4-database-attempt.log` | No root/sudo (`no new privileges` flag set), `apt-get update` fails (permission denied + `403` on the Debian mirror), no `psql`/`postgres` binary anywhere on disk |
| `logs/phase5-backend-tests.log` | Full `node --test` run: **169 pass, 0 fail** |
| `logs/phase11-docker-attempt.log` | `docker`: command not found; `download.docker.com` blocked |

Re-run any of these yourself with the exact commands in the corresponding
section below to reproduce.


Scope: a full audit of everything built across Phases 1-5 (frontend,
backend, Docker, environment variables, database/migrations, API routes,
auth/authz, Cloudinary, Firebase, WhatsApp, SMTP, chat, notifications,
admin panel, search, uploads, favorites, saved searches, reports,
analytics, WebSocket, Google Maps), fixing every real bug found, followed
by dependency/type/lint verification, security and performance review,
provider configuration guidance, Docker/deployment runbooks, and a final
production-readiness report -- run against no new features, per the brief.

## 0. Sandbox constraints (read this first)

This audit was performed inside an isolated sandbox with **no outbound
network access to npm, Docker Hub, Postgres, or any third-party API**, and
no real server to deploy to. Concretely, verified directly:

```
npm ping                          -> 403 Forbidden (blocked-by-allowlist)
docker --version                  -> command not found
psql / pg_ctl                     -> not installed
curl https://registry.npmjs.org   -> 403 blocked-by-allowlist
curl https://api.cloudinary.com   -> 403 blocked-by-allowlist
curl https://fcm.googleapis.com   -> 403 blocked-by-allowlist
curl https://graph.facebook.com   -> 403 blocked-by-allowlist
curl https://maps.googleapis.com  -> 403 blocked-by-allowlist
curl https://api.twilio.com       -> 403 blocked-by-allowlist
```

Given this, every phase below is one of three things, marked explicitly:

- **[DONE]** -- actually executed/verified here (static code audit, the
  real backend test suite, syntax checks).
- **[STATIC]** -- reviewed by reading every relevant line of code and
  cross-checking contracts (types, DTOs, SQL, config), but not exercised
  against a live process (no server/DB/browser available here).
- **[NEEDS YOUR ENVIRONMENT]** -- requires `npm install`, a live Postgres,
  Docker, a browser, or real third-party network access. Exact commands
  are provided; run them in your own terminal/server and report results
  back for further fixes.

## 1. Audit findings

Three real, concrete bugs were found and fixed. Everything else audited
below was found correct.

### Fixed

**1. `docker-compose.yml` and both `.env.example` files were missing every
Phase 3 and Phase 5 environment variable.**
`backend/src/config/env.ts` reads `CLOUDINARY_*`, `GOOGLE_MAPS_API_KEY`
(Phase 3), and `FRONTEND_BASE_URL`, `SMTP_*`, `TWILIO_*`, `FIREBASE_*`,
`WHATSAPP_*` (Phase 5) -- but `docker-compose.yml`'s `backend.environment`
block only listed the Phase 1/2 variables, and the root `.env.example`
stopped at `RATE_LIMIT_AUTH_MAX`. Since docker-compose only forwards
variables it explicitly lists (no `env_file` directive), **every one of
these would have silently been empty inside the container even with a
correctly filled-in root `.env`** -- image upload, geocoding, email, SMS,
push, and WhatsApp would all have silently stayed on their no-op/console
fallbacks in Docker, with no error, no warning, just nothing happening.
Fixed: all of them added to `docker-compose.yml`, root `.env.example`, and
`backend/.env.example`, with the same defaults `env.ts` already falls back
to.

**2. No rate limiting on chat message sending or any WhatsApp endpoint.**
`POST /whatsapp/share` requires no authentication at all (by design --
sharing a listing doesn't need login) and had zero rate limiting, meaning
anyone could script unlimited WhatsApp sends to arbitrary phone numbers
through it at no cost to themselves and real cost/abuse-risk to you.
`POST /whatsapp/contact-owner`, `POST /whatsapp/inquiry`, and
`POST /chat/conversations/:id/messages` were authenticated but also
completely unlimited. Fixed: added `createMessagingRateLimiter` (keyed by
user id when authenticated, falling back to IP for the unauthenticated
share endpoint), wired through `container.ts` and applied to all four
routes. Defaults: 20 requests/minute, configurable via
`RATE_LIMIT_MESSAGING_WINDOW_MS` / `RATE_LIMIT_MESSAGING_MAX`.

**3. (Minor, fixed) `SmtpClient`'s dot-stuffing** only handled a line
starting with `.` when preceded by a newline elsewhere in the body; the
theoretical edge case of the *entire message* starting with a literal `.`
(never triggered by this app's own generated templates, but a real gap
against RFC 5321 as the code's own doc comment claimed to fully implement)
is now also stuffed.

### Reviewed and found correct (no action needed)

- **Auth**: hand-rolled HS256 JWT (`JwtTokenService`) uses `timingSafeEqual`
  for signature comparison, checks `exp`/`iss`/`aud`, and refresh tokens are
  opaque + hashed at rest (not JWTs, so they're server-revocable). Password
  hashing is real `bcrypt` at a configurable cost factor (default 12).
- **SQL injection**: every repository builds parameterized queries
  (`$1, $2, ...`); dynamic `WHERE`/`ORDER BY`/`UPDATE SET` fragments are
  always built from hardcoded column-name maps or a typed
  `Record<SortOption, string>` lookup fed by a zod-validated enum --
  never from raw user input. Spot-checked every repository file; none
  string-concatenate user data into SQL text.
- **File upload**: `multer` with memory storage (never touches disk),
  a MIME-type allowlist (`image/jpeg`, `image/png`, `image/webp`), a
  configurable byte-size cap, and a 10-file limit; Cloudinary transforms
  cap dimensions at upload time. Multer errors are converted to proper 400s
  instead of leaking as 500s.
- **CORS/CSRF**: CORS is scoped to a single configurable origin (not `*`).
  There are no cookies anywhere in the auth flow (pure Bearer-token
  headers), so there's no ambient-credential CSRF surface to begin with.
- **Third-party integrations** (Cloudinary, Twilio, WhatsApp Cloud API,
  FCM, SMTP, Google Geocoding): all real implementations (not mocks), no
  hardcoded secrets, no disabled TLS verification anywhere
  (`rejectUnauthorized` is never overridden), credentials only ever come
  from `env.ts`.
- **Migrations**: every foreign-key column has a supporting index (or is
  covered by a `UNIQUE` constraint, which creates one implicitly);
  `updated_at` triggers, `CHECK` constraints, and soft-delete columns are
  applied consistently with the rest of the schema. No missing/dangling
  references found across all 33 migrations.
- **No placeholders**: zero `TODO`/`FIXME`/"not implemented" markers
  anywhere in `backend/src`; the `as unknown as <ZodInfer>` casts that
  appear throughout controllers are the deliberate, safe pattern for
  reading already-`validate()`-parsed `req.query`, not a code smell.
- **Frontend**: no `dangerouslySetInnerHTML`, `eval`, or `new Function`
  anywhere -- minimal XSS surface by construction.
- **Docker/dotfiles**: both Dockerfiles' multi-stage builds and both
  `.dockerignore` files are correct and consistent with each other.

### Recommendation (not applied -- needs your call)

- **N+1-shaped query pattern in four list endpoints.** `GetRecentlyViewed`,
  `GetRecommendations`, `GetMyFavorites`, and `GetMyProperties` each call
  `PropertyDetailLoader.load()` (6 queries: category, owner, location,
  images, features, favorite-check) once per item via `Promise.all`, so a
  full page of 20 properties fires up to 120 small queries concurrently
  instead of 6 batched `WHERE id = ANY($1)` queries. It's bounded by
  pagination (not unbounded, and each query is a fast indexed lookup) so
  this is a performance optimization opportunity rather than an outage
  risk, but it will show up under real concurrent load, especially if your
  Postgres connection pool is small. I did not rewrite this myself: it
  touches four use-cases plus the shared loader's contract, and I have no
  live Postgres in this sandbox to verify a rewrite against real query
  plans. Recommend revisiting once you have a real database connected --
  I'm glad to implement the batched version and verify it against your
  Postgres at that point.
- **WebSocket auth token in the query string** (`?token=...`) is a known,
  already-documented trade-off from Phase 5 (browsers' native `WebSocket`
  API can't send custom headers on the handshake). It's low-risk here
  (short-lived access tokens, HTTPS/WSS in any real deployment), but query
  strings can end up in server/proxy access logs. A future hardening step
  would be a short-lived, single-use WS ticket endpoint instead of reusing
  the access token directly.
- **JWT access tokens and refresh tokens are stored in `localStorage`** on
  the frontend (not an `httpOnly` cookie). Given there's no XSS sink found
  anywhere in the app (previous bullet), the practical risk today is low,
  but this is a standard SPA trade-off worth knowing about, not something
  I changed unilaterally since it would mean redesigning the auth flow
  around cookies + CSRF tokens -- a design decision, not a bug fix.

## 2. Phase 2 — Dependencies [NEEDS YOUR ENVIRONMENT]

This sandbox cannot reach the npm registry at all (`npm ping` -> 403), so
`npm install` cannot be run or verified here. `package.json` for both
`backend` and `frontend` were reviewed by hand: version ranges are
internally consistent (no two packages requiring conflicting peer
versions), and -- deliberately, since Phase 5 -- **no new dependency was
ever added** for chat/email/SMS/push/WhatsApp; those were hand-built on
Node/browser built-ins specifically because this sandbox has never had
registry access. So there is nothing new to install for Phase 5 beyond
what Phase 3 already required.

Run this in your own terminal (with real internet access):

```bash
cd backend && npm install
cd ../frontend && npm install
```

If either reports peer-dependency conflicts or version errors, paste the
output back here and I'll fix `package.json` accordingly.

## 3. Phase 3 — Type check / lint / format [NEEDS YOUR ENVIRONMENT, partially DONE]

**[DONE]** Every `.ts`/`.tsx` file in both `backend/src`+`backend/tests`
(334 files) and `frontend/src` (63 files) was syntax-checked via
TypeScript's `transpileModule` (the same method used throughout Phases
1-5, since `tsc`/`eslint`/`prettier` themselves aren't installed without
`node_modules`). Result: zero real errors -- the only reported failure in
both cases is a pre-existing, harmless crash on the ambient declaration
files (`src/types/express/index.d.ts`, `vite-env.d.ts`), which
`transpileModule` cannot emit output for by design; this is not a real
error and has been present since Phase 2/3.

**[NEEDS YOUR ENVIRONMENT]** A full type-check needs the real `@types/*`
packages installed. After `npm install` above:

```bash
cd backend && npm run typecheck && npm run lint && npm run format -- --check
cd ../frontend && npm run typecheck && npm run lint && npm run format -- --check
```

Paste back any errors and I'll fix them immediately.

## 4. Phase 4 — Database [STATIC done; NEEDS YOUR ENVIRONMENT to execute]

**[STATIC, DONE]** All 33 migrations were read and verified: every table
has a primary key, every foreign key has a supporting index, every
mutable table has an `updated_at` trigger via the shared
`set_updated_at()` function, `CHECK` constraints are present everywhere
domain rules require them (rating ranges, enum-like status columns,
lat/lng bounds, the messages body-or-image constraint), and soft-delete
columns are applied consistently (with documented exceptions for genuine
1:1 config/detail tables like `user_preferences` and `property_locations`,
which cascade-delete with their parent instead). Seed data
(`seed-roles`, `seed-property-categories`) is idempotent (`ON CONFLICT DO
NOTHING`-style) so re-running migrations is safe.

**[NEEDS YOUR ENVIRONMENT]** To actually create the database and verify
against a live Postgres:

```bash
# Option A: via Docker (see §6 below)
docker compose up -d postgres

# Option B: a local Postgres 16+
createdb rentit
cd backend
cp .env.example .env   # then fill in DATABASE_URL and a real JWT_ACCESS_SECRET
npm run migrate:up
```

Then verify:
```bash
psql "$DATABASE_URL" -c "\dt"                          # 33 tables expected
psql "$DATABASE_URL" -c "\d+ properties"               # spot-check indexes/constraints
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM roles;"   # seed data: 5 roles
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM property_categories;"
```
Paste back the output (especially any migration errors) and I'll fix the
migration files directly.

## 5. Phase 5 — Backend testing [DONE]

Ran the full suite in this sandbox (in-memory fakes, no DB needed --
that's the whole point of this project's testing strategy):

```
node --test tests/**/*.test.ts
# tests 169
# pass 169
# fail 0
```

169/169 passing, including after all three bug fixes above (re-ran the
full suite post-fix to confirm zero regressions). This covers unit tests
(WebSocket framing, saved-search filter matching), integration tests
(auth, properties, admin, chat, notifications, WhatsApp, saved searches,
recently-viewed/recommendations), and one end-to-end journey test.

**[NEEDS YOUR ENVIRONMENT]** Once a real Postgres is connected, the
in-memory-fake-backed tests should be supplemented with real repository
integration tests (a natural next increment, not currently present since
this sandbox never had a database to test against). I can write those
once you confirm a DB connection works.

## 6. Phase 6/7 — Frontend & API testing [STATIC done; NEEDS YOUR ENVIRONMENT to run live]

**[STATIC, DONE]** Every frontend page was re-read against the exact
backend DTO shapes its API calls return (this is how the Phase 5 chat
mismatch -- assuming a `MessageDto` when the wire shape was actually a raw
`Message` entity -- was caught and fixed during that phase; the same
cross-check was repeated here for every controller/route added since).
Every route in `routes/index.ts` was traced to confirm: correct
authentication/authorization middleware, correct validation schema,
correct route-ordering (specific paths like `/mine`, `/favorites`,
`/categories`, `/recently-viewed` before the `/:id` catch-all).

**[NEEDS YOUR ENVIRONMENT]** To actually click through Login, Register,
OTP, Forgot Password, Search, Filters, Favorites, Property Details,
Property Upload, Admin, Reports, Notifications, Chat, Profile, responsive
layouts, dark mode, and offline mode:

```bash
docker compose up -d          # or: npm run dev in both backend/ and frontend/
open http://localhost:5173
```

I'd want you to walk through each flow (or grant a connected environment
where I can drive a real browser) and report back anything that looks
wrong -- screenshots or console errors are ideal.

## 7. Phase 8/9 — Security & performance [DONE, see §1]

Covered in full in §1's "Reviewed and found correct" and "Recommendation"
subsections above -- JWT, password hashing, SQL injection, file upload,
CORS/CSRF, rate limiting (fixed), third-party integration hygiene, and the
N+1 query pattern recommendation.

Additional performance notes:
- **Caching**: the frontend already has an opt-in GET response cache
  (`httpClient`'s `cacheMs` parameter, added in Phase 5, used for the
  property categories list). The backend has no query-result caching layer
  (e.g. Redis) -- reasonable at this stage/scale; worth adding if read
  traffic on `/properties` search grows significantly.
- **Frontend bundle**: no code-splitting/lazy route loading is currently
  configured in `App.tsx` (all pages import eagerly). With `node_modules`
  installed, `vite build` would reveal actual bundle sizes; for a
  ~40-page app aimed at the current dependency list (React + Router only,
  no heavy chart/UI libraries), this is unlikely to be a real problem, but
  `React.lazy()` + `<Suspense>` per route is a safe, low-risk improvement
  I can make on request.
- **Images**: Cloudinary transforms (`quality: auto`, `fetch_format: auto`,
  a 2000x2000 `limit` crop) already handle compression/format
  optimization server-side; `PropertyCard` images use `loading="lazy"`.
- **Memory leaks**: every `useEffect` that subscribes to something
  (WebSocket, `tokenStore`, `online`/`offline` events) has a matching
  cleanup/`unsubscribe` return, checked across every hook/context file.

## 8. Phase 10 — Real service credentials [NEEDS YOUR INPUT + YOUR ENVIRONMENT]

I can't actually call Cloudinary/Firebase/WhatsApp/Twilio/Google Maps from
this sandbox regardless of credentials (see §0) -- every one of those
hosts returned a blocked-by-allowlist 403 when tested directly. So "test
each service and generate screenshots" can only happen in your real
environment. What I can do here is wire whatever you provide into config.

**Please don't paste raw secrets into this chat.** Instead: fill them
directly into your own `backend/.env` (never committed -- it's
`.gitignore`d) using the template in `backend/.env.example` (now complete,
per §1's fix) and `docs/phase-5.md`'s "Provider setup guide", then run the
service yourself and tell me what happened (success, or the exact error).
I'll fix config/code based on that feedback. If you'd like to walk through
them one at a time, tell me which to start with:
Cloudinary, Firebase, WhatsApp Cloud API, SMTP, or Google Maps.

## 9. Phase 11/12 — Docker & staging deployment [NEEDS YOUR ENVIRONMENT]

**Docker.** Not runnable here (`docker` isn't installed in this sandbox).
Both Dockerfiles and `docker-compose.yml` were statically reviewed (see
§1) and the missing-env-var bug is now fixed. Run in your environment:

```bash
docker compose up --build
# then verify:
docker compose ps                                   # all 3 services healthy
curl http://localhost:4000/health                    # backend health check
open http://localhost:5173                            # frontend
docker compose logs backend --tail 50                 # check for startup errors
```

**Staging deployment.** There is no server connected to this session, so
I cannot SSH in, install Nginx/PM2, obtain an SSL cert, or configure a
firewall from here. Below is the exact runbook for a fresh Ubuntu 22.04+
server -- run it there and report back at each checkpoint marked `# CHECK`.

```bash
# 1. Base packages
sudo apt update && sudo apt install -y curl git nginx ufw

# 2. Node 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v   # CHECK: v20.x

# 3. Docker (for Postgres; or install Postgres natively instead)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # log out/in after this

# 4. Clone/copy the project, then configure
git clone <your-repo-url> rentit && cd rentit
cp .env.example .env
# edit .env: real JWT_ACCESS_SECRET (generate per the comment in the file),
# real DATABASE_URL, real CORS_ORIGIN (your domain), and any Phase 5
# provider credentials you're ready to use.

# 5. Bring up Postgres + run migrations
docker compose up -d postgres
cd backend && npm ci && npm run build && npm run migrate:up && cd ..
# CHECK: migrations report success, `psql` shows 33 tables

# 6. Run the backend under PM2 (not docker-compose, for easier PM2 process
#    management/auto-restart on a bare-metal/VM staging box)
cd backend
pm2 start dist/server.js --name rentit-backend
pm2 save
pm2 startup   # follow the printed instructions to enable boot-time restart
cd ..
# CHECK: `pm2 status` shows rentit-backend online; `curl localhost:4000/health` -> 200

# 7. Build the frontend as static assets
cd frontend && npm ci && npm run build && cd ..
# CHECK: frontend/dist/ contains index.html + assets

# 8. Nginx: reverse proxy to the backend, serve the frontend statically,
#    and forward the WebSocket upgrade for chat
sudo tee /etc/nginx/sites-available/rentit <<'EOF'
server {
    listen 80;
    server_name your-domain.example;

    root /path/to/rentit/frontend/dist;
    index index.html;

    location /ws/chat {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location ~ ^/(auth|users|properties|notifications|verification|chat|whatsapp|saved-searches|admin|health) {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/rentit /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# CHECK: `nginx -t` reports syntax ok

# 9. SSL (after DNS for your domain already points at this server)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
# CHECK: https://your-domain.example loads with a valid cert;
#        certbot's auto-renew timer is enabled (`systemctl list-timers | grep certbot`)

# 10. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
# CHECK: only 22/tcp, 80/tcp, 443/tcp are open -- 4000/5432 stay unreachable
#        from outside (Nginx/Docker already restrict them to localhost)
```

Report back the output at each `# CHECK` line (or any error) and I'll
adjust the Nginx config, PM2 setup, or app code as needed.

## 10. Phase 13 — Final QA workflows [STATIC, code-path verified]

Without a running server, browser, or database in this sandbox, "pretend
to be an owner/seeker/admin/moderator" was done as a code-path trace
rather than literal clicking, cross-referencing every step against the
actual controller/use-case/repository chain it would hit:

- **Property Owner**: register -> OTP verify -> add property (image
  upload -> Cloudinary transform -> geocoding) -> submitted as
  `pending_review` -> (admin approves) -> owner gets approval email +
  push (if enabled) -> owner edits listing -> owner sees a chat message
  from a seeker -> replies -> marks conversation read.
- **Property Seeker**: search with filters -> save a search -> browse a
  listing -> favorite it -> message the owner -> contact via WhatsApp ->
  see it in Recently Viewed on next home-page visit -> see Similar
  Properties on the listing page -> get notified when a new listing
  matches their saved search (on the next property approval).
- **Admin**: dashboard stats -> review pending properties -> approve/
  reject with reason -> review a user report -> suspend the reported user
  (blocked from suspending a super_admin or themselves) -> broadcast a
  notification -> check audit log for every action just taken.
- **Moderator** (role-gated the same as admin at the route level): same
  moderation queues, scoped by whatever role-based UI differences exist.

Every step above traces to real, tested code (backed by the 169 passing
tests) -- but "traced through the code and unit-tested" is not the same
guarantee as "clicked through in a real browser," which requires your
environment (§6).

## 11. Phase 14 — Final report

**Total bugs found:** 3 (2 real config/security gaps, 1 minor protocol
edge case) + 1 documented performance recommendation + 2 documented,
already-known design trade-offs (WS auth-in-query-string, localStorage
tokens).

**Total bugs fixed:** 3 of 3 (100% of found bugs, within what's fixable
from this sandbox). Re-verified: 169/169 backend tests still pass after
all fixes; full syntax check clean across 334 backend + 63 frontend files.

**Remaining issues:** none blocking -- everything remaining requires your
real environment to execute (dependency install, live DB, live services,
Docker, browser QA, deployment), and exact commands/runbooks are provided
in §2-§9 above for each.

**Security report:** no injection, auth-bypass, broken-access-control, or
sensitive-data-exposure issues found; one real gap found and fixed
(unrated messaging endpoints); two informational/design-trade-off items
documented for awareness, not forced fixes.

**Performance report:** no slow-API or missing-index issues found; one
N+1-shaped (but pagination-bounded) query pattern documented as a
recommended future optimization, not yet applied pending a live DB to
verify against.

**Database report:** 33 migrations, all additive/reversible, fully
indexed/constrained/triggered; verified statically, pending a live run in
your environment for final confirmation.

**API report:** every route traced for correct auth/authz/validation/route
ordering; rate limiting gap found and fixed; live status-code/pagination/
sorting/upload testing needs your running environment.

**Deployment report:** Docker and staging deployment are fully specified
(runbook in §9) but not executable from this sandbox -- no Docker binary,
no server connection available here.

**Production readiness score: 7/10.**
The codebase itself -- architecture, security posture, test coverage, and
now this audit's fixes -- is in good shape and I'd call code-complete.
The score isn't a 9 or 10 purely because nothing in Phases 2, 4 (live),
6, 7 (live), 10, 11, and 12 has been *executed* yet anywhere -- that's a
sandbox limitation, not a code-quality problem, but "production ready"
has to mean verified in a real environment, not just "should work."
Once you run the commands in §2-§9 and report results back, I'd expect
this to reach 9-10/10 quickly, fixing anything real that surfaces.

**Recommended next steps, in order:**
1. Run `npm install` in both `backend/` and `frontend/` (§2) and report errors.
2. Run `npm run typecheck && npm run lint` in both (§3) and report errors.
3. Bring up Postgres and run migrations (§4) and report errors.
4. Confirm `npm test` still shows 169/169 in your environment (§5).
5. Run the app (Docker or `npm run dev`) and click through the QA
   workflows in §10 for real; report anything broken.
6. Configure any of the Phase 5 provider credentials you're ready to use
   (§8), one at a time.
7. When ready for staging, follow the runbook in §9 checkpoint by
   checkpoint.
