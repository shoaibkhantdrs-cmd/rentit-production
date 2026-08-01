import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "@/api/auth";
import { tokenStore } from "@/api/tokenStore";
import { PublicUser } from "@/api/types";

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  /** Bug fix (QA report #23): true once it's safe to gate a page on
   * `isAuthenticated`. Always true synchronously outside dev builds. In
   * dev, the auto-login effect below resolves asynchronously after
   * mount, so RequireAuth/RequireAdmin used to render their signed-out
   * fallback for one frame before it settled -- this flag lets them wait
   * instead. */
  authReady: boolean;
  /** Step 1 of login: request an OTP for an existing account (or register a new one). */
  requestLoginOtp: (identifier: string) => Promise<void>;
  /** Step 2 of login: verify the code and become authenticated. */
  verifyLoginOtp: (identifier: string, code: string) => Promise<void>;
  register: (input: { name: string; email: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Revokes every session for this account (not just the current
   * device/tab) via the existing POST /auth/logout-all endpoint, then
   * clears local state the same way `logout` does. Resolves with how many
   * sessions were actually revoked, straight from the backend response. */
  logoutAllDevices: () => Promise<number>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => tokenStore.get()?.user ?? null);
  const [authReady, setAuthReady] = useState(() => !import.meta.env.DEV);

  useEffect(() => {
    return tokenStore.subscribe((auth) => setUser(auth?.user ?? null));
  }, []);

  // Dev-only auto-login. `import.meta.env.DEV` is Vite's own build-time
  // flag -- true for `vite`/`npm run dev`, always false for a production
  // build (`vite build`) regardless of what NODE_ENV the resulting static
  // files are later served with, so this is dead code in production, not
  // just conditionally skipped. The backend's `/auth/dev-login` route is
  // the second half of the guard: it only exists when the backend itself
  // is running with NODE_ENV=development, so even hitting this by
  // accident against a real deployment would just 404.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (tokenStore.get()) {
      setAuthReady(true); // already signed in -- don't clobber a real session
      return;
    }

    let cancelled = false;
    authApi
      .devLogin()
      .then((result) => {
        if (cancelled) return;
        tokenStore.set({
          user: result.user,
          tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken, sessionId: result.sessionId },
        });
      })
      .catch((err) => {
        // Non-fatal: e.g. the backend isn't up yet, or its NODE_ENV isn't
        // actually "development". Falls back to the normal AuthPanel
        // (manual register/OTP-login) exactly as before this existed.
        console.warn("Dev auto-login skipped:", err);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const requestLoginOtp = useCallback(async (identifier: string) => {
    const result = await authApi.login({ identifier });
    if (result.mode === "authenticated") {
      tokenStore.set({
        user: result.user,
        tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken, sessionId: result.sessionId },
      });
    }
    // mode === "otp_required": caller shows the code-entry step next.
  }, []);

  const verifyLoginOtp = useCallback(async (identifier: string, code: string) => {
    const result = await authApi.verifyOtp({ identifier, purpose: "login", code });
    if (result.authenticated) {
      tokenStore.set({
        user: result.user,
        tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken, sessionId: result.sessionId },
      });
    }
  }, []);

  const register = useCallback(async (input: { name: string; email: string }) => {
    const result = await authApi.register(input);
    tokenStore.set({
      user: result.user,
      tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken, sessionId: result.sessionId },
    });
  }, []);

  const logout = useCallback(async () => {
    const stored = tokenStore.get();
    tokenStore.clear();
    if (stored) {
      try {
        await authApi.logout(stored.tokens.refreshToken);
      } catch {
        // Token may already be expired/rotated -- local state is already cleared, which is what matters.
      }
    }
  }, []);

  const logoutAllDevices = useCallback(async () => {
    // Needs the current access token, so call it *before* clearing local
    // state (unlike single-device logout, which is a public route keyed
    // off the refresh token alone).
    let revokedSessions = 0;
    try {
      const result = await authApi.logoutAll();
      revokedSessions = result.revokedSessions;
    } finally {
      tokenStore.clear();
    }
    return revokedSessions;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        authReady,
        requestLoginOtp,
        verifyLoginOtp,
        register,
        logout,
        logoutAllDevices,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook intentionally lives alongside its Provider; see Toast.tsx for the
// same documented tradeoff.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
