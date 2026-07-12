import { IIdentityVerificationRepository } from "@/domain/repositories/IIdentityVerificationRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IClock } from "@/domain/services/IClock";
import { NotFoundError } from "@/domain/errors/AppError";

export interface ApproveIdentityVerificationInput {
  verificationId: string;
  actorId: string;
}

export class ApproveIdentityVerificationUseCase {
  constructor(
    private readonly verificationRepo: IIdentityVerificationRepository,
    private readonly userRepo: IUserRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: ApproveIdentityVerificationInput) {
    const verification = await this.verificationRepo.findById(input.verificationId);
    if (!verification) {
      throw new NotFoundError("Verification request not found");
    }

    const updated = await this.verificationRepo.updateStatus(input.verificationId, "approved", input.actorId);
    await this.userRepo.update(verification.userId, { identityVerifiedAt: this.clock.now() });

    await this.notificationRepo.create({
      userId: verification.userId,
      type: "verification.approved",
      title: "Identity verified",
      body: "Your identity verification was approved.",
    });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.verification.approved",
      entityType: "identity_verification",
      entityId: input.verificationId,
      metadata: { targetUserId: verification.userId },
    });

    return updated;
  }
}
