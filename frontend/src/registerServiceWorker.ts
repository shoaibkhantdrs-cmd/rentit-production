/**
 * Phase 6 Part 7 (mobile/PWA): registers public/sw.js. Split into its own
 * module (rather than inlined in main.tsx) so it's trivially unit-testable
 * in isolation and so main.tsx's job stays "mount the React tree."
 *
 * Deliberately skipped outside production: a service worker aggressively
 * caching responses during `vite dev`/HMR is a well-known source of
 * "why isn't my change showing up" confusion, and dev already gets fast
 * reloads from Vite itself with no offline-support need.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Never fatal -- the app must work identically with no offline
      // support as it does with it, just without the offline fallback.
      console.warn("Service worker registration failed:", err);
    });
  });
}
