import { IPropertyRepository, SortOption } from "@/domain/repositories/IPropertyRepository";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { IPropertyImageRepository } from "@/domain/repositories/IPropertyImageRepository";
import { IPropertyCategoryRepository } from "@/domain/repositories/IPropertyCategoryRepository";
import { PropertySummaryDTO } from "./shared/PropertyDetailDTO";

export interface SearchPropertiesInput {
  categorySlug?: string;
  propertyType?: string;
  rentMin?: number;
  rentMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  parkingMin?: number;
  areaMin?: number;
  areaMax?: number;
  city?: string;
  locality?: string;
  furnished?: string;
  availableFrom?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort: SortOption;
  page: number;
  pageSize: number;
}

export interface SearchPropertiesResult {
  items: PropertySummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Builds the public "browse listings" response. Deliberately does NOT use
 * PropertyDetailLoader: that loader does 5 queries *per property*, which
 * would mean 5x(page size) queries for a search result page. Instead this
 * bulk-fetches locations/primary-images/categories for the whole page in
 * three queries total and joins them in memory.
 */
export class SearchPropertiesUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly locationRepo: IPropertyLocationRepository,
    private readonly imageRepo: IPropertyImageRepository,
    private readonly categoryRepo: IPropertyCategoryRepository,
  ) {}

  async execute(input: SearchPropertiesInput): Promise<SearchPropertiesResult> {
    let categoryId: string | undefined;
    if (input.categorySlug) {
      const category = await this.categoryRepo.findBySlug(input.categorySlug);
      // An unknown category slug should return an empty result set, not an
      // error -- it's a filter, not a resource lookup.
      categoryId = category?.id ?? "00000000-0000-0000-0000-000000000000";
    }

    const result = await this.propertyRepo.search({
      filters: {
        categoryId,
        propertyType: input.propertyType,
        rentMin: input.rentMin,
        rentMax: input.rentMax,
        bedroomsMin: input.bedroomsMin,
        bathroomsMin: input.bathroomsMin,
        parkingMin: input.parkingMin,
        areaMin: input.areaMin,
        areaMax: input.areaMax,
        city: input.city,
        locality: input.locality,
        furnished: input.furnished,
        availableFrom: input.availableFrom,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
      },
      sort: input.sort,
      page: input.page,
      pageSize: input.pageSize,
    });

    const propertyIds = result.items.map((item) => item.property.id);

    const [locations, primaryImages, categories] = await Promise.all([
      this.locationRepo.findByPropertyIds(propertyIds),
      this.imageRepo.listPrimaryForProperties(propertyIds),
      this.categoryRepo.findAll(),
    ]);

    const locationByPropertyId = new Map(locations.map((loc) => [loc.propertyId, loc]));
    const imageByPropertyId = new Map(primaryImages.map((img) => [img.propertyId, img]));
    const categoryById = new Map(categories.map((cat) => [cat.id, cat]));

    const items: PropertySummaryDTO[] = result.items.map(({ property, distanceKm }) => {
      const location = locationByPropertyId.get(property.id);
      const image = imageByPropertyId.get(property.id);
      const category = categoryById.get(property.categoryId);

      return {
        id: property.id,
        title: property.title,
        propertyType: property.propertyType,
        status: property.status,
        rentAmount: property.rentAmount,
        areaSqft: property.areaSqft,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        furnishedStatus: property.furnishedStatus,
        availableFrom: property.availableFrom,
        viewCount: property.viewCount,
        favoriteCount: property.favoriteCount,
        createdAt: property.createdAt,
        city: location?.city ?? null,
        locality: location?.locality ?? null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        primaryImageUrl: image?.url ?? null,
        categoryName: category?.name ?? null,
        distanceKm,
      };
    });

    return { items, total: result.total, page: result.page, pageSize: result.pageSize };
  }
}
