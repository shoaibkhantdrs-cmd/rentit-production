import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyReportRepository } from "@/domain/repositories/IPropertyReportRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { ConflictError, NotFoundError } from "@/domain/errors/AppError";
import { PropertyReportReason } from "@/domain/entities/PropertyReport";

export interface ReportPropertyInput {
  propertyId: string;
  reporterUserId: string;
  reason: PropertyReportReason;
  details?: string;
}

export class ReportPropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly reportRepo: IPropertyReportRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: ReportPropertyInput): Promise<void> {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const alreadyReported = await this.reportRepo.existsForUserAndProperty(
      input.propertyId,
      input.reporterUserId,
    );
    if (alreadyReported) {
      throw new ConflictError("You have already reported this listing");
    }

    await this.reportRepo.create({
      propertyId: input.propertyId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details ?? null,
    });

    await this.auditLogRepo.record({
      userId: input.reporterUserId,
      action: "property.reported",
      entityType: "property",
      entityId: input.propertyId,
      metadata: { reason: input.reason },
    });
  }
}
