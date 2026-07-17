# RentIt — Free Hosting Guide

A concrete path to get the backend, frontend, and database live at zero cost, using the free tiers of **Render** (backend), **Netlify** (frontend), and **Neon** (Postgres). All three have genuine no-credit-card free tiers as of mid-2026. This is a separate, lower-cost path from `PRODUCTION_DEPLOYMENT_GUIDE.md` (Railway/Vercel) — pick whichever fits.

## Read this first: what "free" actually costs you here

This app has one feature that free tiers handle badly: **real-time chat over WebSocket**. Render's free web services spin down after 15 minutes of inactivity and take about a minute to wake back up on the next request — and spinning down silently drops any open WebSocket connections. For a portfolio project, demo, or low-traffic soft-launch this is a fine trade-off (a chat message sent while the backend is asleep just takes ~60s to arrive as the server wakes). For anything with real users depending on live chat, budget for a paid always-on tier once you outgrow this.

The other trade-off: Neon's free Postgres scales to zero and has a 100 compute-hour/month cap, both fine for low traffic. Render also offers a free Postgres, but it **expires 30 days after creation** — Neon doesn't, so it's the better default for a database you want to keep.

## What you'll end up with

- **Frontend** (React/Vite static build) on Netlify — free, no sleep, fast CDN.
- **Backend** (Node/Express API + WebSocket) on Render's free web service — free, but sleeps after 15 min idle.
- **Database** (Postgres) on Neon — free, persistent, scale-to-zero.
- Cloudinary, Razorpay/Stripe (test mode), and SMTP each have their own separate free tiers — already covered in `PRODUCTION_DEPLOYMENT_GUIDE.md`'s provider sections; nothing about them changes here.

---

## 1. Database — Neon (free Postgres)

1. Sign up at neon.tech (GitHub login is fastest).
2. Create a project — pick a region close to wherever your Render backend will run (US East, if unsure, since Render's free tier is US-based).
3. Neon gives you a connection string immediately, shown as something like:
   `postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require`
   Copy this — it's your `DATABASE_URL`.
4. This app's migrations run via `node-pg-migrate` from the `backend/` package. Once you have the connection string, run migrations against it locally before your first deploy:
   ```bash
   cd backend
   DATABASE_URL="<your Neon connection string>" npm run migrate:up
   ```
   This creates all 33+ tables (users, properties, payments, chat, notifications, etc.) and seed data (roles, property categories) on the free Neon database.
5. Keep the connection string handy for step 2.

## 2. Backend — Render (free Node web service)

1. Push this repo to GitHub if it isn't already (Render deploys from a Git repo).
2. Sign up at render.com, connect your GitHub account.
3. **New → Web Service**, pick the RentIt repo.
4. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/server.js`
   - **Instance Type:** Free
5. Under **Environment**, add every variable `backend/src/config/env.ts` reads. At minimum, for a working deploy:
   - `NODE_ENV=production`
   - `DATABASE_URL` — the Neon connection string from step 1
   - `JWT_ACCESS_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`; required, the app fails to boot without it in production
   - `CORS_ORIGIN` — your Netlify URL once you have it in step 3 (you can come back and set this after)
   - `PORT` — Render sets this automatically; don't override it (the app already reads `process.env.PORT` via `env.ts`)
   Everything else (`CLOUDINARY_*`, `RAZORPAY_*`, `SMTP_*`, etc.) is optional at first — the app degrades gracefully to console-logging fallbacks for email/SMS if left unset, per `RELEASE_NOTES.md`. Add real values as you connect each provider.
6. Deploy. Render builds and starts the service; watch the logs for `JWT_ACCESS_SECRET must be set` type errors if you missed a required var.
7. Once live, note the Render URL (e.g. `https://rentit-backend.onrender.com`) — that's your API base for the frontend.
8. **Free-tier reality check:** the first request after 15 minutes of idle time will hang for up to ~60 seconds while the service wakes up. If you want to mask this for early users, a free uptime-pinger (e.g. a scheduled task hitting `/health/live` every 10 minutes) keeps it warm — but that also burns through Render's 750 free instance-hours/month faster, so weigh it against just accepting the cold start.

## 3. Frontend — Netlify (free static hosting)

1. Sign up at netlify.com, connect GitHub.
2. **Add new site → Import an existing project**, pick the RentIt repo.
3. Configure:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`
4. Under **Environment variables**, add:
   - `VITE_API_BASE_URL` = your Render backend URL from step 2 (e.g. `https://rentit-backend.onrender.com`)
   This is a Vite build-time variable — it gets baked into the static bundle, so it must be set before the build runs, not after.
5. This app uses client-side routing (React Router, `frontend/src/App.tsx`), so every path needs to fall back to `index.html` or refreshing on `/properties/123` will 404. Add a `frontend/public/_redirects` file (Netlify picks this up automatically) with:
   ```
   /*  /index.html  200
   ```
6. Deploy. Netlify gives you a URL like `https://rentit.netlify.app` (or connect your own free-tier-eligible custom domain later — Netlify's free tier includes HTTPS on custom domains too).
7. **Go back to Render** and set `CORS_ORIGIN` to this exact Netlify URL (no trailing slash) — the backend's CORS check is an explicit allowlist, not a wildcard, so requests from the frontend will fail with a CORS error until this is set correctly.

## 4. Verify it's actually working

- Open the Netlify URL, confirm the homepage loads and hits the backend (check the Network tab for `200`s against your Render URL, not CORS errors).
- Register a test account, confirm OTP-related flows work (they'll log to Render's console logs instead of sending real email/SMS until you configure `SMTP_*`/`TWILIO_*`).
- List a test property, confirm image upload works only once `CLOUDINARY_*` is set — until then, uploads will fail since there's no storage fallback for images (unlike email/SMS).
- Open two browser sessions and test chat — this is the one flow where you'll actually feel the free-tier cold start if the backend has been idle.

## When to graduate off free tier

The two signals worth watching: real users complaining about the ~60s wake-up delay on chat/first request, or Neon's 100 compute-hour/month cap getting hit under real traffic. At that point, `PRODUCTION_DEPLOYMENT_GUIDE.md`'s Railway + Vercel/Netlify path (or Render's own paid always-on tier, which lets you keep everything else about this setup unchanged) removes both constraints for roughly $5-15/month combined.

Sources:
- [Deploy for Free – Render Docs](https://render.com/docs/free)
- [Platforms with a real free tier for developers in 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Neon Serverless Postgres Pricing 2026](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/)
- [Netlify vs Vercel: Free Tier Comparison for Developers in 2026](https://www.productsrelay.com/blog/vercel-vs-netlify-free-tier)
