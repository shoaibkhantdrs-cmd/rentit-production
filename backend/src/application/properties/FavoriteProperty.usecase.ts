import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";
import { IActivityLogRepository } from "@/domain/repositories/IActivityLogRepository";
import { NotFoundError } from "@/domain/errors/AppError";

export class FavoritePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly favoriteRepo: IPropertyFavoriteRepository,
    private readonly activityLogRepo: IActivityLogRepository,
  ) {}

  async execute(propertyId: string, userId: string): Promise<{ favorited: boolean }> {
    const property = await this.propertyRepo.findById(propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const added = await this.favoriteRepo.add(propertyId, userId);
    if (added) {
      await this.propertyRepo.adjustFavoriteCount(propertyId, 1);
      await this.activityLogRepo.record({ userId, action: "property.favorited", metadata: { propertyId } });
    }

    return { favorited: true };
  }
}
