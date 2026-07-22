// Centralized access to build-time environment variables.
// Keeping this in one place means the rest of the app never touches
// import.meta.env directly.
//
// Bug fix: this fallback had been truncated to the bare string "http://"
// (an invalid URL with no host) instead of a real default. Since
// VITE_API_BASE_URL is a build-time value baked into the static bundle,
// any deploy that didn't have it set in the host's build environment
// variables would silently fall back to this string -- and `new URL(path,
// "http://")` throws immediately for every single API call (httpClient.ts,
// useChatSocket.ts, admin.ts), which is exactly what "listings don't load"
// looks like from the outside. Restored to the same localhost:4000 default
// used by .env.example for local dev; production must still set
// VITE_API_BASE_URL explicitly to the real backend URL as a build-time
// variable on whatever host serves the frontend -- this fallback is a
// dev convenience, not a production value.
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000",
} as const;
