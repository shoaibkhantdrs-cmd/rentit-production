import { IPropertyReportRepository } from "@/domain/repositories/IPropertyReportRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { PropertyReportStatus } from "@/domain/entities/PropertyReport";
import { NotFoundError } from "@/domain/errors/AppError";

export interface UpdatePropertyReportStatusInput {
  reportId: string;
  status: PropertyReportStatus; // "reviewed" (resolve) | "dismissed" (dismiss) | "action_taken"
  actorId: string;
}

/** Backs "Resolve Report" and "Dismiss Report" for property reports (Part 4)
 * -- both are this same status transition with a different target value. */
export class UpdatePropertyReportStatusUseCase {
  constructor(
    private readonly reportRepo: IPropertyReportRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: UpdatePropertyReportStatusInput) {
    const report = await this.reportRepo.findById(input.reportId);
    if (!report) {
      throw new NotFoundError("Report not found");
    }

    const updated = await this.reportRepo.updateStatus(input.reportId, input.status, input.actorId);

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: `admin.property_report.${input.status}`,
      entityType: "property_report",
      entityId: input.reportId,
      metadata: { propertyId: report.propertyId },
    });

    return updated;
  }
}
