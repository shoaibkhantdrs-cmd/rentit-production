import { httpClient } from "./httpClient";
import { PublicUser } from "./types";

export interface MyProfile extends PublicUser {
  preferences: {
    language: string;
    timezone: string;
    notifyEmail: boolean;
    notifySms: boolean;
    notifyPush: boolean;
  } | null;
}

export interface UpdateMeInput {
  name?: string;
  /** E.164-ish, e.g. "+919876543210". Pass `null` to clear the number. */
  phone?: string | null;
  preferences?: {
    language?: string;
    timezone?: string;
    notifyEmail?: boolean;
    notifySms?: boolean;
    notifyPush?: boolean;
  };
}

/** GET/PATCH /users/me -- backed by GetMe/UpdateMe use cases that already
 * existed (see UpdateMe.usecase.ts: changing `phone` there already clears
 * phoneVerifiedAt, checks for duplicates, and auto-issues a fresh
 * phone_verification OTP). This module just exposes them to the frontend,
 * which previously never called either endpoint. */
export const usersApi = {
  getMe: () => httpClient.get<MyProfile>("/users/me"),

  /** `devOtp` is only ever populated when the backend's DEV_OTP_MODE is on
   * and this PATCH triggered a fresh phone_verification OTP (i.e. `phone`
   * changed) -- see UpdateMe.usecase.ts / OtpIssuer.issue(). Absent in a
   * normal production response, so every existing caller that ignores it
   * is unaffected. */
  updateMe: (input: UpdateMeInput) => httpClient.patch<MyProfile & { devOtp?: string }>("/users/me", input),

  /** Resends a phone_verification OTP for the phone already on file,
   * without needing the number to change (e.g. the first code expired).
   * `otp` mirrors UpdateMeUseCase's `devOtp` -- populated only when the
   * backend's DEV_OTP_MODE is on (see UserController.requestPhoneOtpHandler
   * / OtpIssuer.issue()), so real Twilio delivery is completely unaffected. */
  requestPhoneOtp: () => httpClient.post<{ message: string; otp?: string }>("/users/me/phone/otp"),
};
