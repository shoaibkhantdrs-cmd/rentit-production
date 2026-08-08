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
    district?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
  // Phase 2 Part 2 (Shop Listing UI). Only meaningful when propertyType ===
  // "shop" -- stored as null for every other property type, same as
  // floorNumber/totalFloors/facing above.
  frontWidthFt?: number | null;
  shopDepthFt?: number | null;
  roadWidthFt?: number | null;
  powerLoad?: string | null;
  isCornerShop?: boolean | null;
  hasWashroom?: boolean | null;
  readyToMove?: boolean | null;
  suitableFor?: string[] | null;
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

    // Phase 3 Part 2: mirrors UpdatePropertyUseCase's guard (c2fe84b) at
    // create time. Previously these 8 fields were stored as
    // `input.X ?? null` with no check on propertyType at all -- trusting
    // the caller to only ever send shop values when propertyType ===
    // "shop" (true for the current frontend form, but not defended
    // against a direct/malformed API call creating e.g. an "apartment"
    // with shop fields populated, which is exactly the class of legacy
    // row the b53e557 backfill had to clean up after the fact). Forcing
    // these to null here whenever the property isn't being created as
    // "shop" prevents that class of row from ever being created going
    // forward, regardless of what the caller sends.
    const isShop = input.propertyType === "shop";

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
      frontWidthFt: isShop ? input.frontWidthFt ?? null : null,
      shopDepthFt: isShop ? input.shopDepthFt ?? null : null,
      roadWidthFt: isShop ? input.roadWidthFt ?? null : null,
      powerLoad: isShop ? input.powerLoad ?? null : null,
      isCornerShop: isShop ? input.isCornerShop ?? null : null,
      hasWashroom: isShop ? input.hasWashroom ?? null : null,
      readyToMove: isShop ? input.readyToMove ?? null : null,
      suitableFor: isShop ? input.suitableFor ?? null : null,
    });

    let latitude = input.location.latitude;
    let longitude = input.location.longitude;
    let formattedAddress: string | null = null;
    let placeId: string | null = null;

    if (latitude === undefined || longitude === undefined) {
      // Bug fix: previously only passed addressLine/city/locality --
      // state/postalCode/country were collected and stored (see
      // locationRepo.upsert below) but never reached the geocoder itself.
      // Passes exactly what was submitted in this request, nothing cached
      // or reused from a prior call.
      const geocoded = await this.geocodingService.geocode({
        addressLine: input.location.addressLine,
        city: input.location.city,
        locality: input.location.locality,
        state: input.location.state,
        postalCode: input.location.postalCode,
        country: input.location.country,
      });
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
      district: input.location.district ?? null,
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
