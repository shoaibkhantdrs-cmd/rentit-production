import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyImageRepository } from "@/domain/repositories/IPropertyImageRepository";
import { IImageStorageService } from "@/domain/services/IImageStorageService";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { assertOwnerOrAdmin } from "./shared/authorization";

const MAX_IMAGES_PER_PROPERTY = 10;

export interface UploadPropertyImagesInput {
  propertyId: string;
  requesterId: string;
  requesterRoles: string[];
  files: Array<{ buffer: Buffer }>;
}

export class UploadPropertyImagesUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly imageRepo: IPropertyImageRepository,
    private readonly imageStorage: IImageStorageService,
  ) {}

  async execute(input: UploadPropertyImagesInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    assertOwnerOrAdmin(property, input.requesterId, input.requesterRoles);

    if (input.files.length === 0) {
      throw new ValidationError("No image files were provided");
    }

    const existingCount = await this.imageRepo.countForProperty(property.id);
    if (existingCount + input.files.length > MAX_IMAGES_PER_PROPERTY) {
      throw new ValidationError(
        `This property already has ${existingCount} image(s); you can add at most ` +
          `${MAX_IMAGES_PER_PROPERTY - existingCount} more (maximum ${MAX_IMAGES_PER_PROPERTY} total).`,
      );
    }

    const uploaded = [];
    for (let i = 0; i < input.files.length; i += 1) {
      const result = await this.imageStorage.upload({
        buffer: input.files[i].buffer,
        folder: `properties/${property.id}`,
      });

      const image = await this.imageRepo.create({
        propertyId: property.id,
        cloudinaryPublicId: result.publicId,
        url: result.url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        isPrimary: existingCount === 0 && i === 0,
        sortOrder: existingCount + i,
      });
      uploaded.push(image);
    }

    return uploaded;
  }
}
