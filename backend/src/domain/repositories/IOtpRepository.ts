import { OtpChannel, OtpCode, OtpPurpose } from "@/domain/entities/OtpCode";

export interface NewOtpInput {
  userId: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  codeHash: string;
  maxAttempts: number;
  expiresAt: Date;
}

export interface IOtpRepository {
  create(input: NewOtpInput): Promise<OtpCode>;
  /** Latest non-consumed, non-expired OTP for this user + purpose, if any. */
  findActive(userId: string, purpose: OtpPurpose): Promise<OtpCode | null>;
  incrementAttempts(id: string): Promise<OtpCode>;
  consume(id: string): Promise<void>;
}
