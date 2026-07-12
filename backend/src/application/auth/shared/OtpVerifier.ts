import { IOtpRepository } from "@/domain/repositories/IOtpRepository";
import { IHasher } from "@/domain/services/IHasher";
import { IClock } from "@/domain/services/IClock";
import { OtpPurpose } from "@/domain/entities/OtpCode";
import { TooManyRequestsError, UnauthorizedError } from "@/domain/errors/AppError";

/**
 * Single place that implements "is this code correct, unexpired, and
 * under the attempt limit" -- used by both VerifyOtp (login/email/phone)
 * and ResetPassword (password_reset), so the anti-brute-force rules can't
 * drift between the two call sites.
 */
export class OtpVerifier {
  constructor(
    private readonly otpRepo: IOtpRepository,
    private readonly hasher: IHasher,
    private readonly clock: IClock,
  ) {}

  async verifyAndConsume(userId: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.otpRepo.findActive(userId, purpose);

    if (!otp) {
      throw new UnauthorizedError("Invalid or expired code");
    }

    if (otp.attempts >= otp.maxAttempts) {
      throw new TooManyRequestsError("Too many incorrect attempts. Request a new code.");
    }

    if (otp.expiresAt.getTime() < this.clock.now().getTime()) {
      throw new UnauthorizedError("Invalid or expired code");
    }

    const isMatch = await this.hasher.verify(code, otp.codeHash);

    if (!isMatch) {
      await this.otpRepo.incrementAttempts(otp.id);
      throw new UnauthorizedError("Invalid or expired code");
    }

    await this.otpRepo.consume(otp.id);
  }
}
