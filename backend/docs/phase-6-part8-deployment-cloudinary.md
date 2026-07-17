# Phase 6 Part 8 — Deployment Guide: Cloudinary

For obtaining dev credentials, see root `docs/phase-3.md` "Cloudinary setup" — this covers what changes for a real production deploy.

## Plan tier

Cloudinary's free tier (25 monthly credits, roughly 25GB combined storage+bandwidth+transformations) is fine for development and early production, but property listings are image-heavy by nature — a few hundred active listings with 5-10 photos each will approach free-tier limits faster than most other parts of this app. Monitor usage from the Cloudinary dashboard and budget for a paid plan (Plus tier starts around real per-listing-photo economics) before it becomes a launch-blocking surprise, not after.

## Production credentials

Use a **separate** Cloudinary account or environment for production vs. development/staging — the same account used for local development testing gets test uploads mixed into the same media library as real user photos, and a leaked dev API secret would also compromise production. `CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET` in `.env.production` should point at a production-only Cloudinary account.

## What's already handled correctly (no change needed)

`CloudinaryImageStorageService` already uploads with `{ width: 2000, height: 2000, crop: "limit" }` (never upscales past the original) and `{ quality: "auto", fetch_format: "auto" }` (Cloudinary serves WebP/AVIF automatically to browsers that support it, at an automatically-chosen quality) — confirmed correct during Part 3's performance audit, no change made or needed there. Images are organized under a `properties/<propertyId>/` folder per listing.

## Security

The API secret must never reach the frontend — uploads go through the backend (`POST /properties/:id/images`, multipart, proxied to Cloudinary server-side), not directly from the browser to Cloudinary with an exposed key. This is already how it's built; worth explicitly confirming during any future change to the upload flow that this doesn't regress (e.g. switching to unsigned direct-to-Cloudinary browser uploads for performance would require moving to upload presets with careful scoping, not the current approach).

## CDN / delivery

Cloudinary serves all delivered images from its own CDN already — no additional CDN configuration needed on RentIt's side. If a custom domain for image delivery is wanted (`images.example.com` instead of `res.cloudinary.com/...`), that's a Cloudinary "private CDN" / custom domain feature configured in their dashboard, not a RentIt code change.
