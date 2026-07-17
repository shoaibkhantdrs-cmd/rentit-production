# Phase 6 Part 8 — Deployment Guide: Google Maps (Geocoding)

For enabling the API and getting a dev key, see root `docs/phase-3.md` "Google Maps setup" — this covers what changes for production.

## Billing

The Geocoding API requires a billing account attached to the Google Cloud project even within the free monthly credit ($200/month as of when this was last verified against Google's own pricing page — **confirm the current figure directly with Google Cloud's pricing docs before budgeting**, since Google has changed Maps Platform pricing more than once). `GoogleGeocodingService` only calls the API when a property is created/updated with an address but no explicit lat/lng, which bounds usage to roughly "one call per new/edited listing," not per page view — search and distance calculations are computed from already-stored coordinates (Haversine, see Part 3's performance doc) and never call this API. Real usage is likely to stay well within the free tier unless listing volume is very high; set a budget alert in Google Cloud Console regardless, since an unexpected usage spike (e.g. a bug that re-geocodes on every save instead of only on address change) is the realistic risk, not baseline traffic.

## Production API key restrictions

The dev setup guide doesn't emphasize this, but it matters for production: restrict the API key (Google Cloud Console → Credentials → the key → Application restrictions) to **IP addresses** matching the backend's production egress IP(s) — not "None," and not "HTTP referrers" (referrer restrictions only make sense for a key used directly from a browser; this key is called server-side from `GoogleGeocodingService` via `fetch`, so it never carries a referrer header at all, and an unrestricted key that leaks is usable by anyone). Also restrict the key's API scope to just "Geocoding API," not every Maps Platform product — least privilege on both axes.

## Separate keys per environment

Use distinct API keys for development/staging vs. production, same reasoning as every other credential in this guide: independent quota tracking, and a dev-environment key leak (far more likely, given how often it ends up in a local `.env` file, shell history, or a screen-shared terminal) doesn't expose the production key.

## Frontend note

`GOOGLE_MAPS_API_KEY` is a **backend-only** environment variable — the frontend never calls Google's API directly (no `VITE_GOOGLE_MAPS_API_KEY` exists, and shouldn't; a browser-embedded key would need referrer restrictions instead of IP restrictions and a different threat model entirely). If a future feature needs client-side maps rendering (an interactive map picker, for instance), that would need its own separate, referrer-restricted, more tightly scoped key — not the existing server-side geocoding key reused in the browser.
