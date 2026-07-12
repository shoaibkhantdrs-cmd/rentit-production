import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IClock } from "@/domain/services/IClock";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface RejectPropertyInput {
  propertyId: string;
  actorId: string;
  reason: string;
}

export class RejectPropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: RejectPropertyInput) {
    if (!input.reason.trim()) {
      throw new ValidationError("A rejection reason is required");
    }

    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const now = this.clock.now();
    const updated = await this.propertyRepo.update(property.id, {
      status: "rejected",
      moderatedBy: input.actorId,
      moderatedAt: now,
      rejectionReason: input.reason.trim(),
    });

    await this.statusHistoryRepo.record({
      propertyId: property.id,
      previousStatus: property.status,
      newStatus: "rejected",
      changedBy: input.actorId,
      reason: input.reason.trim(),
    });

    await this.notificationRepo.create({
      userId: property.ownerId,
      type: "property.rejected",
      title: "Your listing was rejected",
      body: `"${property.title}" was rejected: ${input.reason.trim()}`,
      data: { propertyId: property.id, reason: input.reason.trim() },
    });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.property.rejected",
      entityType: "property",
      entityId: property.id,
      metadata: { reason: input.reason.trim() },
    });

    return updated;
  }
}
