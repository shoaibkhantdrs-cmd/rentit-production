import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyViewRepository } from "@/domain/repositories/IPropertyViewRepository";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";

const DEFAULT_LIMIT = 12;

/** Phase 5 Part 6 ("Recently Viewed"). Reuses the property_views log that
 * GetPropertyUseCase has written to since Phase 3 -- no new table, no new
 * write path, just a read over data that already exists. */
export class GetRecentlyViewedUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly viewRepo: IPropertyViewRepository,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(userId: string, limit = DEFAULT_LIMIT) {
    const propertyIds = await this.viewRepo.listRecentPropertyIdsForUser(userId, limit);
    if (propertyIds.length === 0) return { items: [] };

    const properties = await this.propertyRepo.findManyByIds(propertyIds);
    const byId = new Map(properties.map((property) => [property.id, property]));

    // Re-order to match recency (findManyByIds doesn't guarantee order),
    // and silently drop any that were deleted/unpublished since the view.
    const ordered = propertyIds
      .map((id) => byId.get(id))
      .filter((property): property is NonNullable<typeof property> => property !== undefined && property.status === "published");

    const items = await this.detailLoader.loadMany(ordered, userId);
    return { items };
  }
}
