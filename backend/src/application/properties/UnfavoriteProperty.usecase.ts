import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";
import { IActivityLogRepository } from "@/domain/repositories/IActivityLogRepository";

export class UnfavoritePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly favoriteRepo: IPropertyFavoriteRepository,
    private readonly activityLogRepo: IActivityLogRepository,
  ) {}

  async execute(propertyId: string, userId: string): Promise<{ favorited: boolean }> {
    const removed = await this.favoriteRepo.remove(propertyId, userId);
    if (removed) {
      await this.propertyRepo.adjustFavoriteCount(propertyId, -1);
      await this.activityLogRepo.record({ userId, action: "property.unfavorited", metadata: { propertyId } });
    }

    return { favorited: false };
  }
}
