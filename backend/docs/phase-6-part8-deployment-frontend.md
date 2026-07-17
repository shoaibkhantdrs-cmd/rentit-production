# Phase 6 Part 8 — Deployment Guide: Frontend

This covers hosting the built React app in production. For getting a local dev environment running, see root `docs/phase-3.md`; this is specifically about the choices and gotchas at deploy time.

## Build-time vs. runtime configuration (read this first)

Vite bakes every `VITE_*` environment variable into the static JS bundle **at build time** — `import.meta.env.VITE_API_BASE_URL` is replaced with a literal string when `vite build` runs, not read from the environment of whatever server later serves the files. This means:

- Setting `VITE_API_BASE_URL` in a hosting platform's "environment variables" dashboard does nothing unless that platform runs the build itself with that variable set (most static hosts do — see below).
- A single build artifact is tied to one backend URL. Deploying the same built `dist/` to two environments (staging pointing at a staging API, production pointing at a production API) requires two separate builds, not one build redeployed with different runtime config.
- `docker-compose.prod.yml`'s frontend service passes this as a Docker build arg (`build.args.VITE_API_BASE_URL`) for exactly this reason — it has to be present before/during `vite build` runs inside the image build, not after.

## Hosting options

**Static host (recommended for a pure SPA with no server-side rendering need):** Vercel, Netlify, or Cloudflare Pages. Point the platform at `frontend/`, build command `npm run build`, output directory `dist`, and set `VITE_API_BASE_URL` in that platform's build-time env var settings. All three give a global CDN, automatic HTTPS, and preview deployments per PR for free at this app's likely scale — genuinely less operational work than running the Docker `prod` image yourself, and the recommended default unless there's already infrastructure investment elsewhere.

**The Docker `prod` image (already built, Part 6):** `frontend/Dockerfile`'s `prod` stage serves the build via the `serve` package. Use this when frontend and backend need to live on the same infrastructure (e.g. a single VM running `docker-compose.prod.yml`, or the same Kubernetes cluster) rather than split across a CDN provider and a compute provider. Slightly more to manage (no CDN, no automatic cert renewal — put a reverse proxy like Caddy or nginx in front for TLS, or a load balancer that terminates it) in exchange for one less external dependency.

## Custom domain + TLS

Whichever host is chosen, the frontend's real domain must match what's configured as `CORS_ORIGIN` on the backend (`backend/.env.production`) — a mismatch here is the most common "works locally, fails in production with a CORS error" deploy mistake. Static hosts (Vercel/Netlify/Cloudflare) provision TLS certificates automatically on custom domain setup; a self-hosted `serve` deployment needs a reverse proxy (Caddy auto-provisions via Let's Encrypt with essentially zero config; nginx + certbot is the more manual but more common alternative).

## Caching

Vite's production build already content-hashes every JS/CSS filename (`index-a1b2c3.js`) — this means those files can be cached **forever** (`Cache-Control: public, max-age=31536000, immutable`) since a changed file gets a new URL, never a same-URL update. `index.html` itself must **never** be cached the same way (`Cache-Control: no-cache` or a short max-age) since it's the one file whose content changes on every deploy while keeping the same URL, and it's what references the current hashed bundle. Static hosts generally get this right by default; if serving via nginx/Caddy directly, this is worth setting explicitly rather than trusting a blanket cache rule.

## Mobile (Part 7)

The Android/iOS builds produced via Capacitor (see `docs/phase-6-part7-mobile.md`) bundle a snapshot of `frontend/dist` directly into the native app — they do **not** fetch the frontend from whatever's deployed above at runtime, only the backend API. A frontend-only deploy (e.g. a UI bugfix) does not update already-installed mobile apps; that requires rebuilding and resubmitting to the app stores. Plan release cadence accordingly — a fast-moving web deploy cycle and a slower app-store review cycle are two different tracks, not one.
