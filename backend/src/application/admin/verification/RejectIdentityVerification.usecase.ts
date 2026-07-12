import { IIdentityVerificationRepository } from "@/domain/repositories/IIdentityVerificationRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface RejectIdentityVerificationInput {
  verificationId: string;
  actorId: string;
  reason: string;
}

export class RejectIdentityVerificationUseCase {
  constructor(
    private readonly verificationRepo: IIdentityVerificationRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: RejectIdentityVerificationInput) {
    if (!input.reason.trim()) {
      throw new ValidationError("A rejection reason is required");
    }

    const verification = await this.verificationRepo.findById(input.verificationId);
    if (!verification) {
      throw new NotFoundError("Verification request not found");
    }

    const updated = await this.verificationRepo.updateStatus(
      input.verificationId,
      "rejected",
      input.actorId,
      input.reason.trim(),
    );

    await this.notificationRepo.create({
      userId: verification.userId,
      type: "verification.rejected",
      title: "Identity verification rejected",
      body: `Your identity verification was rejected: ${input.reason.trim()}. You may resubmit with a clearer document.`,
    });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.verification.rejected",
      entityType: "identity_verification",
      entityId: input.verificationId,
      metadata: { targetUserId: verification.userId, reason: input.reason.trim() },
    });

    return updated;
  }
}
