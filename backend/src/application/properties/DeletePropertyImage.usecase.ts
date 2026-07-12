import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyImageRepository } from "@/domain/repositories/IPropertyImageRepository";
import { IImageStorageService } from "@/domain/services/IImageStorageService";
import { NotFoundError } from "@/domain/errors/AppError";
import { assertOwnerOrAdmin } from "./shared/authorization";

export interface DeletePropertyImageInput {
  propertyId: string;
  imageId: string;
  requesterId: string;
  requesterRoles: string[];
}

export class DeletePropertyImageUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly imageRepo: IPropertyImageRepository,
    private readonly imageStorage: IImageStorageService,
  ) {}

  async execute(input: DeletePropertyImageInput): Promise<void> {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    assertOwnerOrAdmin(property, input.requesterId, input.requesterRoles);

    const image = await this.imageRepo.findById(input.imageId);
    if (!image || image.propertyId !== property.id || image.deletedAt) {
      throw new NotFoundError("Image not found on this property");
    }

    await this.imageStorage.destroy(image.cloudinaryPublicId);
    await this.imageRepo.softDelete(image.id);

    if (image.isPrimary) {
      const remaining = (await this.imageRepo.listForProperty(property.id)).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      if (remaining.length > 0) {
        await this.imageRepo.setPrimary(property.id, remaining[0].id);
      }
    }
  }
}
