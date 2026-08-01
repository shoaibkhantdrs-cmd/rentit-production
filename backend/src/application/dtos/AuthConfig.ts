export interface AuthConfig {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  otpLength: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  /** When false (any non-production NODE_ENV), OtpIssuer skips the real SMS
   * provider for phone_verification codes and returns the plaintext code to
   * the caller instead -- see OtpIssuer.issue(). Email OTP delivery is
   * unaffected in either environment. */
  isProduction: boolean;
}
