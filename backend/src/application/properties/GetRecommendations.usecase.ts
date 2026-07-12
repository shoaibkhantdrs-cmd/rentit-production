import { IPropertyRepository, PropertySearchFilters } from "@/domain/repositories/IPropertyRepository";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";
import { NotFoundError } from "@/domain/errors/AppError";

export interface GetRecommendationsInput {
  /** "Similar to this listing" mode, e.g. a property detail page. */
  propertyId?: string;
  /** "For you" mode, based on what this user has favorited. Combined with
   * propertyId if both are given. */
  userId?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 8;
const PRICE_BAND_FRACTION = 0.3; // +/-30% of the seed rent

/**
 * Phase 5 Part 7 ("Recommend similar properties. Based on: Location,
 * Price, Category, Favorites"). Deliberately reuses IPropertyRepository.search
 * (the same query the public browse/search page uses) instead of a new
 * recommendation-specific query path or scoring table -- the "similar"
 * criteria are exactly a normal search filter (same category, a price
 * band around the seed, same city), so there's nothing a bespoke engine
 * would do here that plain search filters don't already do.
 */
export class GetRecommendationsUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly propertyLocationRepo: IPropertyLocationRepository,
    private readonly favoriteRepo: IPropertyFavoriteRepository,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(input: GetRecommendationsInput) {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const excludeId = input.propertyId ?? null;

    const filters: PropertySearchFilters = {};

    if (input.propertyId) {
      const seed = await this.propertyRepo.findById(input.propertyId);
      if (!seed || seed.deletedAt) throw new NotFoundError("Property not found");

      filters.categoryId = seed.categoryId;
      filters.rentMin = Math.round(seed.rentAmount * (1 - PRICE_BAND_FRACTION));
      filters.rentMax = Math.round(seed.rentAmount * (1 + PRICE_BAND_FRACTION));

      const location = await this.propertyLocationRepo.findByPropertyId(seed.id);
      if (location) filters.city = location.city;
    } else if (input.userId) {
      const seedFromFavorites = await this.deriveSeedFromFavorites(input.userId);
      Object.assign(filters, seedFromFavorites);
    }

    const result = await this.propertyRepo.search({
      filters,
      sort: "newest",
      page: 1,
      // fetch a few extra to allow for the seed property being excluded
      pageSize: limit + 1,
    });

    const items = result.items
      .filter((item) => item.property.id !== excludeId)
      .slice(0, limit);

    const dtos = await Promise.all(
      items.map((item) => this.detailLoader.load(item.property, input.userId ?? null)),
    );

    return { items: dtos };
  }

  private async deriveSeedFromFavorites(userId: string): Promise<PropertySearchFilters> {
    const { ids } = await this.favoriteRepo.listPropertyIdsForUser(userId, 1, 20);
    if (ids.length === 0) return {};

    const favorited = await this.propertyRepo.findManyByIds(ids);
    if (favorited.length === 0) return {};

    const categoryCounts = new Map<string, number>();
    let rentSum = 0;
    for (const property of favorited) {
      categoryCounts.set(property.categoryId, (categoryCounts.get(property.categoryId) ?? 0) + 1);
      rentSum += property.rentAmount;
    }

    const topCategoryId = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const averageRent = rentSum / favorited.length;

    return {
      categoryId: topCategoryId,
      rentMin: Math.round(averageRent * (1 - PRICE_BAND_FRACTION)),
      rentMax: Math.round(averageRent * (1 + PRICE_BAND_FRACTION)),
    };
  }
}
