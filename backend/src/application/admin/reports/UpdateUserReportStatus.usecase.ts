import { IUserReportRepository } from "@/domain/repositories/IUserReportRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { UserReportStatus } from "@/domain/entities/UserReport";
import { NotFoundError } from "@/domain/errors/AppError";

export interface UpdateUserReportStatusInput {
  reportId: string;
  status: UserReportStatus;
  actorId: string;
}

export class UpdateUserReportStatusUseCase {
  constructor(
    private readonly reportRepo: IUserReportRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: UpdateUserReportStatusInput) {
    const report = await this.reportRepo.findById(input.reportId);
    if (!report) {
      throw new NotFoundError("Report not found");
    }

    const updated = await this.reportRepo.updateStatus(input.reportId, input.status, input.actorId);

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: `admin.user_report.${input.status}`,
      entityType: "user_report",
      entityId: input.reportId,
      metadata: { reportedUserId: report.reportedUserId },
    });

    return updated;
  }
}
