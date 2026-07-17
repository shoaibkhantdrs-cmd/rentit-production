// Phase 6 Part 7 (mobile/PWA): hand-rolled service worker -- no Workbox /
// vite-plugin-pwa dependency, consistent with this codebase's existing
// pattern of hand-rolling infrastructure a built-in (here: the Cache and
// Fetch APIs, which every supported browser already ships) already
// covers rather than adding a build-tool dependency for it. Also a hard
// constraint in this sandbox: no npm registry access to install one.
//
// Bump CACHE_VERSION whenever this file's caching *strategy* changes (not
// on every app deploy -- the runtime cache below re-populates itself from
// whatever's actually being requested, it doesn't need to know Vite's
// content-hashed build filenames ahead of time). The old cache is deleted
// on activate so a strategy change can't leave stale entries around
// forever.
const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `rentit-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `rentit-runtime-${CACHE_VERSION}`;

// Only files whose names are known ahead of time (not content-hashed by
// the Vite build) -- the hashed JS/CSS bundle is cached at runtime
// instead, the first time each file is actually requested (see the fetch
// handler below), since a static list here can't predict those hashes.
const APP_SHELL_URLS = ["/", "/manifest.webmanifest", "/favicon.ico", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever handle GET -- POST/PUT/PATCH/DELETE (every payment,
  // auth, and mutation endpoint in this app) must always hit the network
  // untouched. The Cache API can't store non-GET requests anyway, but
  // being explicit here avoids ever even trying.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (the backend API, when deployed on a separate origin
  // from the frontend) and any same-origin /api/ path: always network,
  // never cached. This is a rentals marketplace with live availability,
  // messaging, and payment state -- serving stale cached JSON here would
  // be actively misleading, not a helpful offline fallback.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (typing a URL, following a link, refreshing a
  // page) -- network-first so users always get the latest deployed app
  // shell when online, falling back to the cached shell when they're not
  // (this is what makes the app open at all with no connection, instead
  // of a browser error page).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/", { cacheName: APP_SHELL_CACHE })),
    );
    return;
  }

  // Everything else same-origin (the hashed JS/CSS bundle, images, the
  // manifest, icons): cache-first, populating the runtime cache the first
  // time each URL is actually fetched. Safe specifically because Vite
  // content-hashes these filenames -- a changed file gets a new URL, so
  // "serve whatever's cached under this exact URL" can never serve stale
  // content for a URL that changed.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
        }
        return response;
      });
    }),
  );
});
