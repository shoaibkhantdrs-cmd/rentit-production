# Phase 6 Part 7 — Mobile

RentIt is a single React web app (Vite) with no separate mobile codebase. This pass makes it properly installable as a PWA (works today, verified in this sandbox) and prepares it to be wrapped as real Android/iOS builds via Capacitor (the config is written and reviewed; the actual native builds require Android Studio/Xcode, which don't exist in this sandbox — see "Known gaps" below for exactly what running this for real requires).

## App icons

Generated a real icon (not a placeholder/default) from scratch: a house glyph on a brand-blue (`#2563EB`) rounded-square background, built programmatically (Python/Pillow + ImageMagick, since no design tool or npm registry access exists in this sandbox) and reviewed visually before use. Source at `frontend/mobile-assets/icon.png` (1024×1024 — every smaller size is downscaled from this, never upscaled). Derived sizes committed to `frontend/public/icons/`:

- `icon-192.png`, `icon-512.png` — PWA manifest icons (`purpose: "any"`).
- `icon-maskable-512.png` — a separate maskable variant with ~10% safe-zone padding on an opaque (not transparent — required for maskable icons) background, so Android's adaptive-icon masking (circle/squircle/rounded-square, chosen by the OS/launcher) doesn't clip the house glyph.
- `apple-touch-icon.png` (180×180) — iOS home-screen icon; iOS does not read the manifest's icons array at all for this.
- `frontend/public/favicon.ico` — combined 16px+32px multi-resolution favicon.

## Splash screens

`frontend/mobile-assets/splash.png` (2732×2732, brand-blue background with the icon centered at ~32% scale) — the standard single source size Capacitor's asset generator (`@capacitor/assets`, added as a dependency, not yet run — see "Known gaps") derives every platform- and orientation-specific splash image from, rather than hand-producing dozens of exact pixel sizes per device. `capacitor.config.ts`'s `SplashScreen` plugin block also configures the native splash behavior (1.5s show duration, matching background color, no spinner) for once the native projects exist.

## Manifest validation

`frontend/public/manifest.webmanifest` (linked from `index.html` via `<link rel="manifest">`) — validated two ways: `JSON.parse` (well-formed) and a direct check against Chrome's actual PWA installability criteria (`name`, `short_name`, `start_url`, `display: standalone`, a 192×192 icon, a 512×512 icon, and a maskable-purpose icon all present). Both checks pass — see `docs/logs/phase6-part7-pwa-verification.log`.

`index.html` also gained the iOS-specific tags the manifest can't cover (iOS ignores manifest icons/theme_color for "Add to Home Screen"): `apple-touch-icon` link, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, plus a `theme-color` meta tag for browsers that do read it.

## PWA verification (offline support / installability)

**Added: `frontend/public/sw.js`**, a hand-rolled service worker — no Workbox/`vite-plugin-pwa` dependency (this sandbox has no npm registry access to install one anyway, but it's also consistent with this codebase's established pattern of hand-rolling infrastructure a browser built-in already covers, same reasoning as the compression middleware in Part 3). Strategy:

- Same-origin `/api/*` paths and any cross-origin request (the backend, when deployed separately): always network, never cached — a rentals/payments app must never serve stale cached JSON for listings, messages, or payment state.
- Non-GET requests: never intercepted, always network — every mutation (auth, payments, messaging) is unaffected by the service worker's existence.
- Navigation requests: network-first, falling back to the cached app shell (`/`) when offline — this is what makes the installed app open at all with no connection instead of a browser error page.
- Everything else same-origin (the Vite-hashed JS/CSS bundle, icons): cache-first, populating the runtime cache the first time each URL is actually requested. Safe specifically because Vite content-hashes build filenames — a changed file is a new URL, so this can never serve stale content for something that changed.

Registered from `frontend/src/registerServiceWorker.ts` (called once from `main.tsx`), skipped in dev (`import.meta.env.DEV`) so Vite's HMR is never fought by an aggressively-caching service worker during development.

Verified with a fake `ServiceWorkerGlobalScope`/Cache API/`fetch` harness exercising the real (unmodified) `sw.js` file's `install`/`activate`/`fetch` handlers directly — 9/9 checks passed (app-shell precaching, stale-cache cleanup, API/cross-origin/non-GET bypass, offline navigation fallback, runtime asset caching). See `docs/logs/phase6-part7-pwa-verification.log`. Node has no real service worker environment, so this is not a substitute for an actual browser check (Chrome DevTools → Application → Service Workers, and a Lighthouse PWA audit) before launch — called out explicitly below.

## Android / iOS build preparation

Added Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/assets` — declared as dependencies, not yet installed, same "known gap" as Part 6's missing lockfiles) and `frontend/capacitor.config.ts`, configured with `webDir: "dist"` (the exact same production build the frontend Dockerfile serves — no separate mobile-only build path to maintain) and the matching brand color/splash settings. npm scripts added: `cap:sync`, `cap:add:android`, `cap:add:ios`, `cap:open:android`, `cap:open:ios`, `cap:assets`.

**To actually produce an Android/iOS build once real tooling is available**, in order:

```bash
cd frontend
npm install                       # after committing a real lockfile, per Part 6
npm run build                     # produces dist/ from the current web app
npx cap add android               # generates frontend/android/ (first time only)
npx cap add ios                   # generates frontend/ios/ (first time only, requires macOS)
npm run cap:assets                # generates every platform icon/splash size from mobile-assets/
npx cap sync                      # copies dist/ + config into both native projects
npm run cap:open:android          # opens Android Studio -> Build > Generate Signed Bundle/APK
npm run cap:open:ios              # opens Xcode -> Product > Archive (requires an Apple Developer account + signing certificate)
```

## Known gaps (require tooling this sandbox does not have)

1. **No Android SDK/Gradle or Xcode in this sandbox** — `npx cap add android`/`ios` and every step after it could not actually be run or verified here. The config, icons, and splash source are prepared and reviewed; the native projects themselves must be generated on a real machine with that tooling installed.
2. **No lockfiles** — same gap as Part 6; `npm install` for the Capacitor packages has never actually run.
3. **App icon is an original, programmatically-generated placeholder**, not a designed brand asset — functional and on-brand-colored, but worth swapping for a real designed icon (replace `frontend/mobile-assets/icon.png` and `splash.png`, then re-run `npm run cap:assets`) before a real store submission.
4. **No real browser/Lighthouse PWA audit run** — the service worker and manifest were verified with Node-based harnesses simulating browser APIs, not an actual Chrome/Lighthouse pass. Recommended before launch: open the deployed site in Chrome, run DevTools → Lighthouse → PWA, and confirm the "Add to Home Screen" prompt actually appears.
5. **App store listing requirements** (screenshots, privacy policy URL, store descriptions, content ratings) are out of scope for this pass — they're store-submission artifacts, not code, and depend on decisions (pricing, region availability) not yet made.
