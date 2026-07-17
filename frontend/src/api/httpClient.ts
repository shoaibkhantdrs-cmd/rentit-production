import { env } from "@/config/env";
import { ApiErrorBody } from "./types";
import { tokenStore } from "./tokenStore";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** FormData for multipart uploads -- skips JSON.stringify + Content-Type. */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set to false for auth endpoints that must not attach a stale token. */
  authenticated?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, env.apiBaseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Attempts a single silent token refresh, de-duplicated across concurrent 401s. */
async function tryRefresh(): Promise<boolean> {
  const stored = tokenStore.get();
  if (!stored) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(buildUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: stored.tokens.refreshToken }),
        });
        if (!res.ok) return false;
        const body = (await parseBody(res)) as { accessToken: string; refreshToken: string } | null;
        if (!body) return false;
        tokenStore.set({
          user: stored.user,
          tokens: { accessToken: body.accessToken, refreshToken: body.refreshToken, sessionId: stored.tokens.sessionId },
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

// --- Phase 5 Part 8: a tiny in-memory GET cache -----------------------
// Deliberately minimal: a Map keyed by the resolved URL, storing an
// in-flight/settled promise plus an expiry. Good enough for rarely-changing
// reference data (e.g. property categories) without pulling in a full data
// library like react-query -- see docs/phase-5.md for the "why not X"
// rationale, matching the same "smallest thing that actually works"
// approach used for real-time/email/WhatsApp in the backend.
const getCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

/** Thrown when a request is attempted (or a non-cached GET is requested)
 * while the browser reports itself offline -- fails fast instead of
 * waiting out a TCP timeout, so the UI can show a clear "you're offline"
 * state immediately. */
export class OfflineError extends Error {
  constructor() {
    super("You're offline. Check your connection and try again.");
    this.name = "OfflineError";
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, query, authenticated = true } = options;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new OfflineError();
  }

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!formData) headers["Content-Type"] = "application/json";

    if (authenticated) {
      const stored = tokenStore.get();
      if (stored) headers.Authorization = `Bearer ${stored.tokens.accessToken}`;
    }

    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  };

  let res = await doFetch();

  if (res.status === 401 && authenticated && tokenStore.get()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      tokenStore.clear();
    }
  }

  if (!res.ok) {
    const parsed = (await parseBody(res)) as ApiErrorBody | null;
    const message = parsed?.error?.message ?? `Request failed with status ${res.status}`;
    const code = parsed?.error?.code ?? "UNKNOWN_ERROR";
    throw new ApiError(res.status, code, message, parsed?.error?.details);
  }

  return (await parseBody(res)) as T;
}

export const httpClient = {
  /** `cacheMs` is opt-in and 0 (off) by default, so every existing call
   * site's behavior is unchanged. Pass a positive value for reference
   * data that's safe to serve stale for a few seconds/minutes (see
   * propertiesApi.categories). */
  get: <T,>(path: string, query?: RequestOptions["query"], authenticated = true, cacheMs = 0): Promise<T> => {
    if (cacheMs <= 0) return request<T>(path, { method: "GET", query, authenticated });

    const key = buildUrl(path, query);
    const cached = getCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;

    const promise = request<T>(path, { method: "GET", query, authenticated });
    getCache.set(key, { expiresAt: Date.now() + cacheMs, promise });
    // Don't keep a rejected request cached -- let the next call retry.
    promise.catch(() => getCache.delete(key));
    return promise;
  },

  post: <T,>(path: string, body?: unknown, authenticated = true) =>
    request<T>(path, { method: "POST", body, authenticated }),

  postForm: <T,>(path: string, formData: FormData, authenticated = true) =>
    request<T>(path, { method: "POST", formData, authenticated }),

  patch: <T,>(path: string, body?: unknown, authenticated = true) =>
    request<T>(path, { method: "PATCH", body, authenticated }),

  // RC1: added for adminApi.updateUserRoles, which was calling a PATCH
  // that the backend has never accepted -- the route is PUT (see
  // backend/src/interfaces/http/routes/admin.routes.ts).
  put: <T,>(path: string, body?: unknown, authenticated = true) =>
    request<T>(path, { method: "PUT", body, authenticated }),

  delete: <T,>(path: string, authenticated = true) => request<T>(path, { method: "DELETE", authenticated }),
};
