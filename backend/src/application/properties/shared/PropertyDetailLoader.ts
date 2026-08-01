import { Property } from "@/domain/entities/Property";
import { PropertyCategory } from "@/domain/entities/PropertyCategory";
import { PropertyLocation } from "@/domain/entities/PropertyLocation";
import { PropertyImage } from "@/domain/entities/PropertyImage";
import { PropertyFeature } from "@/domain/entities/PropertyFeature";
import { User } from "@/domain/entities/User";
import { IPropertyCategoryRepository } from "@/domain/repositories/IPropertyCategoryRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { IPropertyImageRepository } from "@/domain/repositories/IPropertyImageRepository";
import { IPropertyFeatureRepository } from "@/domain/repositories/IPropertyFeatureRepository";
import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";
import { PropertyDetailDTO } from "./PropertyDetailDTO";

/**
 * Gathers every related piece of a single property (category, owner,
 * location, images, features, favorited-by-viewer) and shapes it into the
 * DTO returned by create/get/update/mine. Deliberately not used by search
 * results -- those are built from bulk-fetched, joined data instead to
 * avoid an N+1 query per row (see SearchProperties.usecase.ts).
 */
export class PropertyDetailLoader {
  constructor(
    private readonly categoryRepo: IPropertyCategoryRepository,
    private readonly userRepo: IUserRepository,
    private readonly locationRepo: IPropertyLocationRepository,
    private readonly imageRepo: IPropertyImageRepository,
    private readonly featureRepo: IPropertyFeatureRepository,
    private readonly favoriteRepo: IPropertyFavoriteRepository,
  ) {}

  async load(property: Property, viewerUserId?: string | null): Promise<PropertyDetailDTO> {
    const [category, owner, location, images, features, isFavorited] = await Promise.all([
      this.categoryRepo.findById(property.categoryId),
      this.userRepo.findById(property.ownerId),
      this.locationRepo.findByPropertyId(property.id),
      this.imageRepo.listForProperty(property.id),
      this.featureRepo.listForProperty(property.id),
      viewerUserId ? this.favoriteRepo.exists(property.id, viewerUserId) : Promise.resolve(null),
    ]);

    return this.assemble(property, category, owner, location, images, features, isFavorited);
  }

  /**
   * Batched equivalent of calling load() once per property. Fixes the N+1
   * (6 queries x page size) that GetMyFavorites/GetMyProperties/
   * GetRecentlyViewed/GetRecommendations previously had by looping load():
   * this does a fixed, small number of queries (one per related table, no
   * matter how many properties are in `properties`) and joins everything
   * in memory, reusing the exact same DTO-assembly logic as load() so the
   * response shape is byte-for-byte identical to before -- only the query
   * count changes.
   */
  async loadMany(properties: Property[], viewerUserId?: string | null): Promise<PropertyDetailDTO[]> {
    if (properties.length === 0) return [];

    const propertyIds = properties.map((p) => p.id);
    const ownerIds = [...new Set(properties.map((p) => p.ownerId))];

    const [categories, owners, locations, images, features, favoritedIds] = await Promise.all([
      // Categories are a small, effectively-static reference table --
      // SearchProperties.usecase.ts already fetches all of them the same
      // way for the same reason (one query beats N).
      this.categoryRepo.findAll(),
      this.userRepo.findManyByIds(ownerIds),
      this.locationRepo.findByPropertyIds(propertyIds),
      this.imageRepo.listForProperties(propertyIds),
      this.featureRepo.listForProperties(propertyIds),
      viewerUserId
        ? this.favoriteRepo.listFavoritedPropertyIds(viewerUserId, propertyIds)
        : Promise.resolve<string[] | null>(null),
    ]);

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const locationByPropertyId = new Map(locations.map((l) => [l.propertyId, l]));

    const imagesByPropertyId = new Map<string, PropertyImage[]>();
    for (const image of images) {
      const list = imagesByPropertyId.get(image.propertyId);
      if (list) list.push(image);
      else imagesByPropertyId.set(image.propertyId, [image]);
    }

    const featuresByPropertyId = new Map<string, PropertyFeature[]>();
    for (const feature of features) {
      const list = featuresByPropertyId.get(feature.propertyId);
      if (list) list.push(feature);
      else featuresByPropertyId.set(feature.propertyId, [feature]);
    }

    const favoritedSet = favoritedIds ? new Set(favoritedIds) : null;

    return properties.map((property) =>
      this.assemble(
        property,
        categoryById.get(property.categoryId) ?? null,
        ownerById.get(property.ownerId) ?? null,
        locationByPropertyId.get(property.id) ?? null,
        imagesByPropertyId.get(property.id) ?? [],
        featuresByPropertyId.get(property.id) ?? [],
        favoritedSet ? favoritedSet.has(property.id) : null,
      ),
    );
  }

  private assemble(
    property: Property,
    category: PropertyCategory | null,
    owner: User | null,
    location: PropertyLocation | null,
    images: PropertyImage[],
    features: PropertyFeature[],
    isFavorited: boolean | null,
  ): PropertyDetailDTO {
    return {
      id: property.id,
      title: property.title,
      description: property.description,
      propertyType: property.propertyType,
      status: property.status,
      rentAmount: property.rentAmount,
      securityDeposit: property.securityDeposit,
      areaSqft: property.areaSqft,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parkingSpaces: property.parkingSpaces,
      floorNumber: property.floorNumber,
      totalFloors: property.totalFloors,
      facing: property.facing,
      furnishedStatus: property.furnishedStatus,
      availableFrom: property.availableFrom,
      viewCount: property.viewCount,
      favoriteCount: property.favoriteCount,
      publishedAt: property.publishedAt,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      owner: owner ? { id: owner.id, name: owner.name } : null,
      location: location
        ? {
            addressLine: location.addressLine,
            city: location.city,
            locality: location.locality,
            state: location.state,
            country: location.country,
            postalCode: location.postalCode,
            latitude: location.latitude,
            longitude: location.longitude,
            formattedAddress: location.formattedAddress,
          }
        : null,
      images: images
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((img) => ({
          id: img.id,
          url: img.url,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
          width: img.width,
          height: img.height,
        })),
      features: features.map((f) => f.featureKey),
      isFavorited,
      distanceKm: null,
    };
  }
}
