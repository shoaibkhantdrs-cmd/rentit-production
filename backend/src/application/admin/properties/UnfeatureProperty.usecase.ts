import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { NotFoundError } from "@/domain/errors/AppError";

export interface UnfeaturePropertyInput {
  propertyId: string;
  actorId: string;
}

export class UnfeaturePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: UnfeaturePropertyInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const updated = await this.propertyRepo.update(property.id, { isFeatured: false });

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.property.unfeatured",
      entityType: "property",
      entityId: property.id,
    });

    return updated;
  }
}
