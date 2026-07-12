import { Property } from "@/domain/entities/Property";
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
      images: images.map((img) => ({
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
