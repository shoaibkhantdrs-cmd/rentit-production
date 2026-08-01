import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";

export interface RequestPhoneOtpInput {
  userId: string;
}

/**
 * "Verify Phone" button on the Profile page's Contact Information section:
 * (re)sends a phone_verification OTP for the phone number already on file,
 * without requiring the number to change. UpdateMeUseCase already issues a
 * fresh OTP automatically when a phone value *changes* (see its
 * phoneChanged branch) -- this covers the other case: the number is
 * unchanged (already saved, still unverified) and the user just wants a
 * code, e.g. the first one expired or never arrived.
 */
export class RequestPhoneOtpUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly otpIssuer: OtpIssuer,
  ) {}

  async execute(input: RequestPhoneOtpInput): Promise<{ devOtp?: string }> {
    const user = await this.userRepo.findById(input.userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }
    if (!user.phone) {
      throw new ValidationError("Add a phone number before requesting a verification code.");
    }

    return this.otpIssuer.issue(user, "phone_verification");
  }
}
