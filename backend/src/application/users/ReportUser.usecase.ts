import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserReportRepository } from "@/domain/repositories/IUserReportRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { UserReportReason } from "@/domain/entities/UserReport";

export interface ReportUserInput {
  reportedUserId: string;
  reporterUserId: string;
  reason: UserReportReason;
  details?: string;
}

/** Self-service: any authenticated user can report another user (e.g. a
 * bad-faith owner). Structural mirror of ReportPropertyUseCase (Phase 3). */
export class ReportUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly reportRepo: IUserReportRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: ReportUserInput): Promise<void> {
    if (input.reportedUserId === input.reporterUserId) {
      throw new ValidationError("You cannot report yourself");
    }

    const reportedUser = await this.userRepo.findById(input.reportedUserId);
    if (!reportedUser || reportedUser.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const alreadyReported = await this.reportRepo.existsForUserAndReporter(
      input.reportedUserId,
      input.reporterUserId,
    );
    if (alreadyReported) {
      throw new ConflictError("You have already reported this user");
    }

    await this.reportRepo.create({
      reportedUserId: input.reportedUserId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details ?? null,
    });

    await this.auditLogRepo.record({
      userId: input.reporterUserId,
      action: "user.reported",
      entityType: "user",
      entityId: input.reportedUserId,
      metadata: { reason: input.reason },
    });
  }
}
