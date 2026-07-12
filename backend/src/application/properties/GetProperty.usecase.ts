import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IPropertyViewRepository } from "@/domain/repositories/IPropertyViewRepository";
import { NotFoundError } from "@/domain/errors/AppError";
import { isOwnerOrAdmin } from "./shared/authorization";
import { PropertyDetailLoader } from "./shared/PropertyDetailLoader";

export interface GetPropertyInput {
  propertyId: string;
  viewerUserId: string | null;
  viewerRoles: string[];
  ipAddress: string | null;
  userAgent: string | null;
}

const VIEW_DEDUP_WINDOW_MINUTES = 30;

export class GetPropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly viewRepo: IPropertyViewRepository,
    private readonly detailLoader: PropertyDetailLoader,
  ) {}

  async execute(input: GetPropertyInput) {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const canViewUnpublished =
      input.viewerUserId !== null && isOwnerOrAdmin(property, input.viewerUserId, input.viewerRoles);

    if (property.status !== "published" && !canViewUnpublished) {
      // 404, not 403 -- don't confirm a non-published listing exists to
      // someone who isn't allowed to see it.
      throw new NotFoundError("Property not found");
    }

    const viewerKey = input.viewerUserId ?? input.ipAddress ?? "anonymous";
    const alreadyViewedRecently = await this.viewRepo.hasRecentView(
      property.id,
      viewerKey,
      VIEW_DEDUP_WINDOW_MINUTES,
    );

    if (!alreadyViewedRecently) {
      await this.viewRepo.record({
        propertyId: property.id,
        viewerUserId: input.viewerUserId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      await this.propertyRepo.incrementViewCount(property.id);
      property.viewCount += 1; // keep the in-memory object consistent for the response below
    }

    return this.detailLoader.load(property, input.viewerUserId);
  }
}
