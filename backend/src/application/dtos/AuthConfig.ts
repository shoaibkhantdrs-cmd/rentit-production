export interface AuthConfig {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  otpLength: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
}
