import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { authApi } from "@/api/auth";
import { tokenStore } from "@/api/tokenStore";
import { PublicUser } from "@/api/types";

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  /** Step 1 of login: request an OTP for an existing account (or register a new one). */
  requestLoginOtp: (identifier: string) => Promise<void>;
  /** Step 2 of login: verify the code and become authenticated. */
  verifyLoginOtp: (identifier: string, code: string) => Promise<void>;
  register: (input: { name: string; email: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => tokenStore.get()?.user ?? null);

  useEffect(() => {
    return tokenStore.subscribe((auth) => setUser(auth?.user ?? null));
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

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, requestLoginOtp, verifyLoginOtp, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
