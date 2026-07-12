import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { INotificationRepository } from "@/domain/repositories/INotificationRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { IClock } from "@/domain/services/IClock";
import { NotFoundError } from "@/domain/errors/AppError";

export interface HidePropertyInput {
  propertyId: string;
  actorId: string;
  reason?: string;
}

/**
 * "Hide Listing" (Part 4, also reachable from Part 3's "Hidden
 * Properties"): sets status to "inactive", the same status an owner can
 * set on their own listing to pause it -- an admin-hidden listing looks
 * identical to the owner as a self-paused one, but the moderation history
 * records who actually did it and why.
 */
export class HidePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: HidePropertyInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const updated = await this.propertyRepo.update(property.id, {
      status: "inactive",
      moderatedBy: input.actorId,
      moderatedAt: this.clock.now(),
    });

    await this.statusHistoryRepo.record({
      propertyId: property.id,
      previousStatus: property.status,
      newStatus: "inactive",
      changedBy: input.actorId,
      reason: input.reason ?? "Hidden by admin",
    });

    await this.notificationRepo.create({
      userId: property.ownerId,
      type: "property.hidden",
      title: "Your listing was hidden",
      body: `"${property.title}" has been hidden by a moderator${input.reason ? `: ${input.reason}` : "."}`,
      data: { propertyId: property.id },
    });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.property.hidden",
      entityType: "property",
      entityId: property.id,
      metadata: { reason: input.reason ?? null },
    });

    return updated;
  }
}
