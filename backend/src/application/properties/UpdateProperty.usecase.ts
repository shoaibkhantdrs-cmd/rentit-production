import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyLocationRepository } from "@/domain/repositories/IPropertyLocationRepository";
import { IPropertyFeatureRepository } from "@/domain/repositories/IPropertyFeatureRepository";
import { IPropertyStatusHistoryRepository } from "@/domain/repositories/IPropertyStatusHistoryRepository";
import { IGeocodingService } from "@/domain/services/IGeocodingService";
import { IClock } from "@/domain/services/IClock";
import { ForbiddenError, NotFoundError } from "@/domain/errors/AppError";
import {
  Facing,
  FurnishedStatus,
  PropertyStatus,
  PropertyType,
} from "@/domain/entities/Property";
import { assertOwnerOrAdmin, PROPERTY_ADMIN_ROLES } from "./shared/authorization";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";

export interface UpdatePropertyInput {
  propertyId: string;
  requesterId: string;
  requesterRoles: string[];
  title?: string;
  description?: string;
  categoryId?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  rentAmount?: number;
  securityDeposit?: number;
  areaSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  floorNumber?: number | null;
  totalFloors?: number | null;
  facing?: Facing | null;
  furnishedStatus?: FurnishedStatus;
  availableFrom?: string;
  features?: string[];
  location?: {
    addressLine?: string;
    city?: string;
    locality?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };
}

export class UpdatePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly locationRepo: IPropertyLocationRepository,
    private readonly featureRepo: IPropertyFeatureRepository,
    private readonly statusHistoryRepo: IPropertyStatusHistoryRepository,
    private readonly geocodingService: IGeocodingService,
    private readonly clock: IClock,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(input: UpdatePropertyInput) {
    const existing = await this.propertyRepo.findById(input.propertyId);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    assertOwnerOrAdmin(existing, input.requesterId, input.requesterRoles);

    const patch: Parameters<IPropertyRepository["update"]>[1] = {};
    const fields: (keyof UpdatePropertyInput)[] = [
      "title",
      "description",
      "categoryId",
      "propertyType",
      "rentAmount",
      "securityDeposit",
      "areaSqft",
      "bedrooms",
      "bathrooms",
      "parkingSpaces",
      "floorNumber",
      "totalFloors",
      "facing",
      "furnishedStatus",
      "availableFrom",
    ];
    for (const field of fields) {
      const value = input[field];
      if (value !== undefined) {
        (patch as Record<string, unknown>)[field] = value;
      }
    }

    const statusChanged = input.status !== undefined && input.status !== existing.status;
    if (statusChanged) {
      const isAdmin = input.requesterRoles.some((role) =>
        (PROPERTY_ADMIN_ROLES as readonly string[]).includes(role),
      );

      // Security fix: this endpoint is owner-facing (PATCH /properties/:id,
      // gated only by `authenticate`, not an admin role) -- without this
      // check a property_owner could self-publish a listing that was never
      // reviewed, or simply PATCH a status straight back to "published"
      // right after an admin hid it for a policy violation, undermining
      // moderation entirely. Admin-role requesters are unrestricted (their
      // real moderation path is ApproveProperty/BulkModerateProperties,
      // which already enforce their own admin-only authorization -- this
      // only tightens the *owner* path).
      if (!isAdmin) {
        if (input.status === "published") {
          throw new ForbiddenError(
            "Only an admin can publish a listing. Submit it for review instead.",
          );
        }
        if (existing.status === "inactive") {
          throw new ForbiddenError(
            "This listing was hidden by an admin and can't be reactivated by its owner.",
          );
        }
      }

      patch.status = input.status;
      if (input.status === "published" && !existing.publishedAt) {
        patch.publishedAt = this.clock.now();
      }
    }

    const updated =
      Object.keys(patch).length > 0 ? await this.propertyRepo.update(existing.id, patch) : existing;

    if (statusChanged) {
      await this.statusHistoryRepo.record({
        propertyId: existing.id,
        previousStatus: existing.status,
        newStatus: updated.status,
        changedBy: input.requesterId,
      });
    }

    if (input.location) {
      const current = await this.locationRepo.findByPropertyId(existing.id);
      const addressLine = input.location.addressLine ?? current?.addressLine;
      const city = input.location.city ?? current?.city;

      if (!addressLine || !city) {
        throw new NotFoundError("Property location not found");
      }

      let latitude = input.location.latitude ?? current?.latitude;
      let longitude = input.location.longitude ?? current?.longitude;
      let formattedAddress = current?.formattedAddress ?? null;
      let placeId = current?.placeId ?? null;

      const addressChanged =
        input.location.addressLine !== undefined || input.location.city !== undefined;
      const coordsProvided = input.location.latitude !== undefined || input.location.longitude !== undefined;

      if (addressChanged && !coordsProvided) {
        const geocoded = await this.geocodingService.geocode(
          addressLine,
          city,
          input.location.locality ?? current?.locality,
        );
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
        formattedAddress = geocoded.formattedAddress;
        placeId = geocoded.placeId;
      }

      await this.locationRepo.upsert({
        propertyId: existing.id,
        addressLine,
        city,
        locality: input.location.locality ?? current?.locality ?? null,
        state: input.location.state ?? current?.state ?? null,
        country: input.location.country ?? current?.country ?? null,
        postalCode: input.location.postalCode ?? current?.postalCode ?? null,
        latitude: latitude as number,
        longitude: longitude as number,
        formattedAddress,
        placeId,
      });
    }

    if (input.features) {
      await this.featureRepo.setForProperty(existing.id, input.features);
    }

    return this.detailLoader.load(updated, input.requesterId);
  }
}
