import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { NotFoundError } from "@/domain/errors/AppError";
import { assertOwnerOrAdmin } from "./shared/authorization";

export interface DeletePropertyInput {
  propertyId: string;
  requesterId: string;
  requesterRoles: string[];
}

export class DeletePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
  ) {}

  async execute(input: DeletePropertyInput): Promise<void> {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    assertOwnerOrAdmin(property, input.requesterId, input.requesterRoles);

    await this.propertyRepo.softDelete(property.id);
    await this.statusHistoryRepo.record({
      propertyId: property.id,
      previousStatus: property.status,
      newStatus: "removed",
      changedBy: input.requesterId,
      reason: "Listing deleted by owner/admin",
    });
  }
}
