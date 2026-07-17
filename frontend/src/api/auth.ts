import { httpClient } from "./httpClient";
import { AuthTokens, PublicUser } from "./types";

export interface RegisterResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export type LoginResult =
  | { mode: "authenticated"; user: PublicUser; accessToken: string; refreshToken: string; sessionId: string }
  | { mode: "otp_required" };

export type VerifyOtpResult =
  | {
      verified: true;
      authenticated: true;
      user: PublicUser;
      accessToken: string;
      refreshToken: string;
      sessionId: string;
    }
  | { verified: true; authenticated: false };

export const authApi = {
  register: (input: { name: string; email: string; phone?: string; password?: string }) =>
    httpClient.post<RegisterResult>("/auth/register", input, false),

  login: (input: { identifier: string; password?: string }) =>
    httpClient.post<LoginResult>("/auth/login", input, false),

  verifyOtp: (input: { identifier: string; purpose: "login" | "email_verification" | "phone_verification"; code: string }) =>
    httpClient.post<VerifyOtpResult>("/auth/verify-otp", input, false),

  logout: (refreshToken: string) => httpClient.post<void>("/auth/logout", { refreshToken }, false),

  logoutAll: () => httpClient.post<{ revokedSessions: number }>("/auth/logout-all", undefined, true),

  /**
   * Dev-only, no-OTP, no-email auto-login. The backend route this calls
   * (`POST /auth/dev-login`) is only registered at all when the backend is
   * running with NODE_ENV=development -- in a production build/server it
   * 404s. AuthContext only ever calls this when `import.meta.env.DEV` is
   * true, i.e. never in a production frontend build either. Two
   * independent guards, so there's no single flag that could leak this
   * into production.
   */
  devLogin: () => httpClient.post<RegisterResult>("/auth/dev-login", undefined, false),
};

export type { AuthTokens };
