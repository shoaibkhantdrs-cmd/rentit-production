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
};

export type { AuthTokens };
