import { AuthTokens, PublicUser } from "./types";

const STORAGE_KEY = "rentit.auth";

export interface StoredAuth {
  user: PublicUser;
  tokens: AuthTokens;
}

type Listener = (auth: StoredAuth | null) => void;

const listeners = new Set<Listener>();
let cached: StoredAuth | null | undefined; // undefined = not yet read from storage

function readFromStorage(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

/** Centralized token storage so both the fetch client (for auth headers /
 * silent refresh) and the AuthContext (for reactive UI state) read and
 * write the exact same source of truth without importing each other. */
export const tokenStore = {
  get(): StoredAuth | null {
    if (cached === undefined) {
      cached = readFromStorage();
    }
    return cached;
  },

  set(auth: StoredAuth): void {
    cached = auth;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    listeners.forEach((listener) => listener(auth));
  },

  clear(): void {
    cached = null;
    window.localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((listener) => listener(null));
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
