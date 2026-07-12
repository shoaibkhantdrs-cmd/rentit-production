import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IEmailService } from "@/domain/services/IEmailService";
import { IClock } from "@/domain/services/IClock";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { buildPropertyApprovalEmail } from "@/application/notifications/EmailTemplates";
import { NotifySavedSearchesForPropertyUseCase } from "@/application/savedsearches/NotifySavedSearchesForProperty.usecase";

export interface ApprovePropertyInput {
  propertyId: string;
  actorId: string;
}

export class ApprovePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly clock: IClock,
    private readonly userRepo: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly notifySavedSearches: NotifySavedSearchesForPropertyUseCase,
  ) {}

  async execute(input: ApprovePropertyInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }
    if (property.status === "published") {
      throw new ValidationError("This property is already published");
    }

    const now = this.clock.now();
    const updated = await this.propertyRepo.update(property.id, {
      status: "published",
      publishedAt: property.publishedAt ?? now,
      moderatedBy: input.actorId,
      moderatedAt: now,
      rejectionReason: null,
    });

    await this.statusHistoryRepo.record({
      propertyId: property.id,
      previousStatus: property.status,
      newStatus: "published",
      changedBy: input.actorId,
      reason: "Approved by admin",
    });

    await this.notificationRepo.create({
      userId: property.ownerId,
      type: "property.approved",
      title: "Your listing was approved",
      body: `"${property.title}" is now live on RentIt.`,
      data: { propertyId: property.id },
    });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.property.approved",
      entityType: "property",
      entityId: property.id,
    });

    const owner = await this.userRepo.findById(property.ownerId);
    if (owner) {
      await this.emailService.send(buildPropertyApprovalEmail(owner.email, owner.name, property.title));
    }

    await this.notifySavedSearches.execute(updated);

    return updated;
  }
}
