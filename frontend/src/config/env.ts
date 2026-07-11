// Centralized access to build-time environment variables.
// Keeping this in one place means the rest of the app never touches
// import.meta.env directly.
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000",
} as const;
