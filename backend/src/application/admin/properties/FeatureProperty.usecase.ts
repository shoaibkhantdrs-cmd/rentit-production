import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface FeaturePropertyInput {
  propertyId: string;
  actorId: string;
}

/** Featured is an orthogonal flag, not a status -- only published listings
 * can be featured (surfacing a rejected/hidden listing would be a bug, not
 * a feature). */
export class FeaturePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: FeaturePropertyInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }
    if (property.status !== "published") {
      throw new ValidationError("Only a published listing can be featured");
    }

    const updated = await this.propertyRepo.update(property.id, { isFeatured: true });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.property.featured",
      entityType: "property",
      entityId: property.id,
    });

    return updated;
  }
}
