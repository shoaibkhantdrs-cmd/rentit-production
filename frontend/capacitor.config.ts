import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Phase 6 Part 7 (mobile): Capacitor wraps the existing built web app
 * (frontend/dist, the exact same Vite production build served by
 * `serve` in the frontend Dockerfile's `prod` stage) in a thin native
 * WebView shell -- no rewrite, no separate React Native codebase to
 * maintain in parallel. `webDir: "dist"` is why `npm run build` must run
 * before `cap sync` picks up fresh web assets (see the commands in
 * docs/phase-6-part7-mobile.md).
 *
 * `androidScheme`/`iosScheme` are set to "https" (not Capacitor's default
 * "http" on Android) so `secure`-flagged cookies and any same-site
 * cookie checks behave the same inside the native shell as they do in a
 * real browser -- this app doesn't use cookies for auth (bearer JWTs in
 * memory/localStorage), but getting this right costs nothing and avoids
 * a class of "works on web, subtly broken in the app" bugs for anything
 * added later that does rely on cookie semantics.
 */
const config: CapacitorConfig = {
  appId: "com.rentit.app",
  appName: "RentIt",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
  android: {
    // Matches this app's manifest.webmanifest theme_color -- consistent
    // brand color for the Android status bar / splash background.
    backgroundColor: "#2563EB",
  },
  ios: {
    backgroundColor: "#2563EB",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#2563EB",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
