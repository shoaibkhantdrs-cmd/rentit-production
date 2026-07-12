import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyCategoryRepository } from "@/domain/repositories/IPropertyCategoryRepository";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { IPropertyFeatureRepository } from "@/domain/repositories/IPropertyFeatureRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { IGeocodingService } from "@/domain/services/IGeocodingService";
import { NotFoundError } from "@/domain/errors/AppError";
import { Facing, FurnishedStatus, PropertyType } from "@/domain/entities/Property";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";

export interface CreatePropertyInput {
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  propertyType: PropertyType;
  rentAmount: number;
  securityDeposit: number;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floorNumber?: number | null;
  totalFloors?: number | null;
  facing?: Facing | null;
  furnishedStatus: FurnishedStatus;
  availableFrom: string;
  features?: string[];
  location: {
    addressLine: string;
    city: string;
    locality?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
}

export class CreatePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly categoryRepo: IPropertyCategoryRepository,
    private readonly locationRepo: IPropertyLocationRepository,
    private readonly featureRepo: IPropertyFeatureRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
    private readonly geocodingService: IGeocodingService,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(input: CreatePropertyInput) {
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category) {
      throw new NotFoundError("Property category not found");
    }

    const property = await this.propertyRepo.create({
      ownerId: input.ownerId,
      categoryId: input.categoryId,
      title: input.title.trim(),
      description: input.description.trim(),
      propertyType: input.propertyType,
      rentAmount: input.rentAmount,
      securityDeposit: input.securityDeposit,
      areaSqft: input.areaSqft,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      parkingSpaces: input.parkingSpaces,
      floorNumber: input.floorNumber ?? null,
      totalFloors: input.totalFloors ?? null,
      facing: input.facing ?? null,
      furnishedStatus: input.furnishedStatus,
      availableFrom: input.availableFrom,
    });

    let latitude = input.location.latitude;
    let longitude = input.location.longitude;
    let formattedAddress: string | null = null;
    let placeId: string | null = null;

    if (latitude === undefined || longitude === undefined) {
      const geocoded = await this.geocodingService.geocode(
        input.location.addressLine,
        input.location.city,
        input.location.locality,
      );
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      formattedAddress = geocoded.formattedAddress;
      placeId = geocoded.placeId;
    }

    await this.locationRepo.upsert({
      propertyId: property.id,
      addressLine: input.location.addressLine,
      city: input.location.city,
      locality: input.location.locality ?? null,
      state: input.location.state ?? null,
      country: input.location.country ?? null,
      postalCode: input.location.postalCode ?? null,
      latitude,
      longitude,
      formattedAddress,
      placeId,
    });

    if (input.features && input.features.length > 0) {
      await this.featureRepo.setForProperty(property.id, input.features);
    }

    await this.statusHistoryRepo.record({
      propertyId: property.id,
      previousStatus: null,
      newStatus: property.status,
      changedBy: input.ownerId,
      reason: "Listing created",
    });

    return this.detailLoader.load(property, input.ownerId);
  }
}
