import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IIdentityVerificationRepository } from "@/domain/repositories/IIdentityVerificationRepository";
import { NotFoundError } from "@/domain/errors/AppError";

/** "Verification Status" (Part 5), self-service: email/phone verification
 * booleans (already on the user) plus the latest identity_verifications
 * submission, if any. */
export class GetMyVerificationStatusUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly verificationRepo: IIdentityVerificationRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const latest = await this.verificationRepo.findLatestForUser(userId);

    return {
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      identityVerified: user.identityVerifiedAt !== null,
      identityVerification: latest,
    };
  }
}
