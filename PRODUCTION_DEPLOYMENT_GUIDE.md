# RentIt — Production Deployment Guide

Concrete, step-by-step instructions for this exact stack:

- **Backend:** Railway
- **Frontend:** Vercel (Netlify steps included as a drop-in alternative — they're nearly identical)
- **Database:** PostgreSQL (via Railway's managed Postgres plugin)
- **Images:** Cloudinary (production account)
- **Payments:** Razorpay Live
- **Email:** SMTP (production provider)
- **Domain + HTTPS**

This assumes `RELEASE_NOTES.md` and `DEPLOYMENT_CHECKLIST.md` (project root) have already been read — in particular, **do the prerequisites in `DEPLOYMENT_CHECKLIST.md` section 0 first** (real `npm install`, real test run, migrations tested against a staging database). This guide is the "how to actually click the buttons" companion to that checklist, not a replacement for it.

Do the steps in this order — later steps depend on values from earlier ones (the backend needs the database's connection string before it can boot; the frontend needs the backend's URL before it can build).

---

## 1. Domain + HTTPS

You need (at minimum) two hostnames, both under a domain you control:

- `app.yourdomain.com` (or the bare root domain) → frontend
- `api.yourdomain.com` → backend

Buy the domain from any registrar (Namecheap, Google Domains/Squarespace, GoDaddy — doesn't matter which). Don't point DNS anywhere yet; you'll come back to this after Railway and Vercel give you the specific records they want in step 3 and step 4. Both Railway and Vercel provision TLS certificates automatically once you add a custom domain and the DNS record is verified — there is no separate "install an SSL cert" step to do yourself with this stack.

---

## 2. PostgreSQL on Railway

1. Create a Railway account, then **New Project → Provision PostgreSQL**.
2. Railway creates the database and exposes a `DATABASE_URL` reference variable on that Postgres service automatically — you do not construct this connection string by hand the way `docker-compose.prod.yml` does locally (that file builds it from `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`; Railway's plugin gives you one ready-made string instead). This works cleanly with this codebase because `backend/src/config/env.ts` reads a single `DATABASE_URL` directly — no code changes needed either way.
3. Note the project — you'll reference this Postgres service's `DATABASE_URL` from the backend service in step 3.

---

## 3. Backend on Railway

1. In the same Railway project, **New → GitHub Repo**, connect this repository.
2. Railway auto-detects `backend/Dockerfile`. Set the service's **root directory** to `backend/` and confirm it builds the `prod` target (the Dockerfile already defines a multi-stage build with a `prod` stage — Railway's Dockerfile builder respects the last stage by default, which is `prod` here, so no extra config is normally needed; if it asks, point it at that stage explicitly).
3. **Link the database:** in the backend service's Variables tab, add `DATABASE_URL` and set its value to a reference of the Postgres service's `DATABASE_URL` (Railway's variable-reference picker, `${{Postgres.DATABASE_URL}}`-style) rather than copy-pasting the literal string — this way it stays correct automatically if the database ever moves.
4. **Set every other required variable** from `.env.production.example` in the backend service's Variables tab (Railway's raw-editor / "paste .env" import makes this fast — paste the whole block, then fill in the blanks). Do not skip any of these:

   ```
   BACKEND_PORT=4000
   CORS_ORIGIN=https://app.yourdomain.com
   LOG_LEVEL=info
   JWT_ACCESS_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   JWT_ACCESS_TOKEN_TTL_SECONDS=900
   REFRESH_TOKEN_TTL_SECONDS=2592000
   JWT_ISSUER=rentit
   JWT_AUDIENCE=rentit-clients
   BCRYPT_SALT_ROUNDS=12
   OTP_LENGTH=6
   OTP_TTL_SECONDS=300
   OTP_MAX_ATTEMPTS=5
   RATE_LIMIT_AUTH_WINDOW_MS=900000
   RATE_LIMIT_AUTH_MAX=10
   RATE_LIMIT_MESSAGING_WINDOW_MS=60000
   RATE_LIMIT_MESSAGING_MAX=20
   CLOUDINARY_CLOUD_NAME=<from step 5>
   CLOUDINARY_API_KEY=<from step 5>
   CLOUDINARY_API_SECRET=<from step 5>
   MAX_IMAGE_UPLOAD_BYTES=10485760
   GOOGLE_MAPS_API_KEY=<your production Geocoding key, restricted to the Geocoding API and your server's egress IP if static>
   FRONTEND_BASE_URL=https://app.yourdomain.com
   SMTP_HOST=<from step 7>
   SMTP_PORT=587
   SMTP_SECURE=true
   SMTP_USERNAME=<from step 7>
   SMTP_PASSWORD=<from step 7>
   SMTP_FROM_ADDRESS=no-reply@yourdomain.com
   RAZORPAY_KEY_ID=<from step 6, live key>
   RAZORPAY_KEY_SECRET=<from step 6, live key>
   RAZORPAY_WEBHOOK_SECRET=<from step 6>
   PAYMENT_CURRENCY=INR
   METRICS_TOKEN=<generate a random value>
   ```

   `PORT` — Railway injects its own `PORT` variable and expects the app to listen on it; this codebase's `env.ts` already reads `PORT` (falling back to 4000), so you generally don't need to set it yourself — Railway's injected value takes precedence. Leave `BACKEND_PORT` set anyway since `docker-compose.prod.yml` / local runs still use it.

   Firebase (`FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`), Twilio, and WhatsApp variables are only required if you're using push notifications, SMS, or WhatsApp in this release — set them if so, per `backend/docs/phase-6-part8-deployment-firebase.md` and `-whatsapp.md`.

5. **Deploy.** Railway builds the Docker image and starts it. Watch the deploy log for the `Missing required environment variable` errors `env.ts` throws on boot if anything above was missed — the app is designed to fail loudly here rather than start half-configured.
6. **Run migrations once**, against this same database, before the app serves real traffic. From your machine (with `DATABASE_URL` pointed at the Railway Postgres — Railway's dashboard has a "connect" tab with the external connection string) or via Railway's one-off shell:
   ```
   cd backend
   DATABASE_URL="<railway external connection string>" npm run migrate:up
   ```
   This is deliberately not run automatically on container start (see `backend/docs/phase-6-part8-deployment-backend.md` — auto-running migrations on every container start races if you ever scale to more than one instance).
7. **Custom domain:** in the backend service's Settings → Networking → Custom Domain, add `api.yourdomain.com`. Railway shows you a CNAME record — add it at your domain registrar/DNS provider. TLS provisions automatically once that record resolves.
8. **Verify:** once the domain is live, `curl https://api.yourdomain.com/health/live` should return a 200. `https://api.yourdomain.com/health` additionally checks the database connection.

**One thing this codebase doesn't yet handle if you scale the backend beyond one Railway instance:** the WebSocket chat gateway holds each connected user's socket in that single process's memory. A second instance can't see the first instance's connections. Fine at one instance (Railway's default); needed before scaling up is either Railway's sticky-session routing or a shared Redis pub/sub layer — neither is implemented in this codebase yet since it wasn't needed for a single-instance launch. See `backend/docs/phase-6-part8-deployment-backend.md` for the full explanation.

---

## 4. Frontend on Vercel

1. Vercel dashboard → **Add New → Project**, import this repository.
2. **Root directory:** `frontend/`.
3. **Framework preset:** Vite (Vercel usually auto-detects this from `frontend/package.json`).
4. **Build command:** `npm run build`. **Output directory:** `dist`.
5. **Environment variable — critical:** add `VITE_API_BASE_URL` = `https://api.yourdomain.com`, and make sure it's set for the **Production** environment specifically (Vercel lets you scope env vars per environment — Preview deployments can point at a staging API if you have one, Production must point at the real one). This has to be set *before* the build runs: Vite bakes `VITE_*` variables into the static JS bundle at build time, not read at runtime by whatever serves the files afterward — see `backend/docs/phase-6-part8-deployment-frontend.md` for why a value set here after the fact does nothing until the next rebuild.
6. Deploy.
7. **Custom domain:** Project Settings → Domains → add `app.yourdomain.com`. Vercel shows the DNS record to add (usually a CNAME, or an A record if using the apex/root domain). TLS provisions automatically.
8. **Go back to the backend** (step 3.4) and confirm `CORS_ORIGIN` on Railway is set to this exact domain (`https://app.yourdomain.com`, matching scheme and no trailing slash) — a mismatch here is the single most common "works locally, breaks in production with a CORS error" mistake, per the same deployment doc.

### Netlify (equivalent alternative)

If you use Netlify instead: **Add new site → Import an existing project**, base directory `frontend/`, build command `npm run build`, publish directory `frontend/dist`, and set `VITE_API_BASE_URL` in **Site settings → Environment variables** the same way. Custom domain and automatic HTTPS work the same way as Vercel. Everything else in this guide is unaffected by which of the two you pick.

---

## 5. Cloudinary Production

1. Create (or upgrade) a Cloudinary account for production use — don't reuse a personal/dev account's free-tier cloud for real user uploads if you can avoid it, since usage/quota and access are then shared with dev traffic.
2. Dashboard home page shows **Cloud name**, **API Key**, **API Secret** directly — copy all three into the backend's `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (step 3.4).
3. Check your plan's transform-request quota. RC1 added delivery-time transforms (`w_`/`c_fill`/`q_auto`/`f_auto`) to every property-image render site (card thumbnails, gallery hero/thumbnails/lightbox) — this means more distinct transformed variants are requested than in v1.0, which counts against Cloudinary's transformation quota depending on plan tier. Worth a quick check against expected listing-photo volume before launch, per `RELEASE_NOTES.md`.
4. No frontend-side Cloudinary config needed — all uploads go through the backend (`CloudinaryImageStorageService`), and the frontend only ever receives back the resulting `secure_url`.

---

## 6. Razorpay Live

Going from Razorpay test mode to live mode is an account-level activation, not just a key swap:

1. In the Razorpay Dashboard, complete **Activation / KYC** (business details, bank account, PAN, etc.) — this is a manual review process on Razorpay's side and is not instant; start it well before your target launch date.
2. Once activated, switch the dashboard to **Live mode** (top-left toggle) and generate **Live API Keys** (Settings → API Keys). These are different from your test keys.
3. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the backend (step 3.4) to the live values.
4. **Webhooks:** Settings → Webhooks → Add New Webhook.
   - **URL:** `https://api.yourdomain.com/webhooks/razorpay`
   - Select the events this app's `WebhookController` handles (payment captured/failed, refund processed — check `backend/src/interfaces/http/controllers/WebhookController.ts` for the exact set if you need to confirm).
   - Razorpay gives you a **webhook secret** when you save it — set that as `RAZORPAY_WEBHOOK_SECRET` on the backend. Signature verification against this secret is the *only* authentication on that endpoint (it's intentionally unauthenticated otherwise, since Razorpay's server can't present a user JWT) — get this value wrong and every webhook call will be rejected, not silently accepted insecurely.
5. If also supporting Stripe, the same pattern applies at `https://api.yourdomain.com/webhooks/stripe` with `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`/`STRIPE_WEBHOOK_SECRET`; this app supports both providers side by side, not one-or-the-other.
6. **Test before real traffic:** Razorpay's dashboard lets you send a test webhook event to a live URL even before going fully live — use this to confirm the endpoint returns 200 before pointing real payment traffic at it.

---

## 7. SMTP Production

1. Pick a transactional email provider (SendGrid, Postmark, Amazon SES, Mailgun — any standard SMTP-capable one; this app talks plain SMTP via `SMTP_HOST`/`SMTP_PORT`/`SMTP_USERNAME`/`SMTP_PASSWORD`, no provider-specific SDK).
2. Create an API/SMTP credential in that provider, set `SMTP_HOST`, `SMTP_PORT` (587 with `SMTP_SECURE=true` is the standard STARTTLS setup most providers expect), `SMTP_USERNAME`, `SMTP_PASSWORD` on the backend (step 3.4).
3. Set `SMTP_FROM_ADDRESS` to an address at your real domain (`no-reply@yourdomain.com`), not the provider's default sandbox sender.
4. **Before launch, set up SPF, DKIM, and DMARC DNS records** at your domain registrar for `yourdomain.com`, using the exact values your provider's dashboard gives you — do this well before launch, not after, since DNS propagation and provider verification can take time and mail sent without these records is far more likely to land in spam. Every provider's dashboard has a "domain authentication" or "verified senders" section that walks through the exact records to add.
5. Send a real test email (registration OTP is the simplest real trigger — register a test account against the live backend once deployed) and confirm it lands in an inbox, not spam.

---

## 8. Final wiring checklist

By this point you should have:

- [ ] `api.yourdomain.com` → Railway backend, HTTPS working, `/health/live` returns 200.
- [ ] `app.yourdomain.com` → Vercel (or Netlify) frontend, HTTPS working, loads the app.
- [ ] Backend's `CORS_ORIGIN` = exactly `https://app.yourdomain.com`.
- [ ] Frontend's `VITE_API_BASE_URL` = exactly `https://api.yourdomain.com` (baked in at build time — redeploy the frontend if this was wrong the first time, setting it after the fact does nothing).
- [ ] Migrations run against the Railway Postgres database (including the two RC1 migrations — trigram indexes and the saved-searches partial index).
- [ ] Cloudinary, Razorpay live keys + webhook, and SMTP all set on the backend.
- [ ] SPF/DKIM/DMARC verified for your domain.

Then work through `DEPLOYMENT_CHECKLIST.md`'s remaining sections (Observability, Final checks) for the full smoke test — register a real account, list a property, search, message an owner, make one real test payment, and confirm it in the admin panel — before calling this live.
