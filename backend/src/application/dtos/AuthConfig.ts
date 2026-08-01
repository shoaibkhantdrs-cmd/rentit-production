export interface AuthConfig {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  otpLength: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  /** When true, OtpIssuer skips the real SMS provider for phone_verification
   * codes and returns the plaintext code to the caller instead -- see
   * OtpIssuer.issue(). Sourced from the dedicated DEV_OTP_MODE env var
   * (config/env.ts), not NODE_ENV -- Render sets NODE_ENV=production on
   * every deployed web service regardless of whether a real Twilio account
   * is configured, so an isProduction-based check never bypassed Twilio on
   * this deployment. Email OTP delivery (login/email_verification/
   * password_reset) is unaffected regardless of this flag. */
  devOtpMode: boolean;
}
