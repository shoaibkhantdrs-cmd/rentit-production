import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IClock } from "@/domain/services/IClock";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface UnhidePropertyInput {
  propertyId: string;
  actorId: string;
}

export class UnhidePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: UnhidePropertyInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }
    if (property.status !== "inactive") {
      throw new ValidationError("Only a hidden (inactive) listing can be unhidden");
    }

    const updated = await this.propertyRepo.update(property.id, {
      status: "published",
      moderatedBy: input.actorId,
      moderatedAt: this.clock.now(),
    });

    await this.statusHistoryRepo.record({
      propertyId: property.id,
      previousStatus: property.status,
      newStatus: "published",
      changedBy: input.actorId,
      reason: "Unhidden by admin",
    });

    await this.notificationRepo.create({
      userId: property.ownerId,
      type: "property.unhidden",
      title: "Your listing is visible again",
      body: `"${property.title}" has been restored to published.`,
      data: { propertyId: property.id },
    });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.property.unhidden",
      entityType: "property",
      entityId: property.id,
    });

    return updated;
  }
}
