export type OtpPurpose =
  | "login"
  | "email_verification"
  | "phone_verification"
  | "password_reset";

export type OtpChannel = "email" | "sms";

export interface OtpCode {
  id: string;
  userId: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
