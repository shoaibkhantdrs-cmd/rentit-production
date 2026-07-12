import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IWhatsAppService } from "@/domain/services/IWhatsAppService";
import { NotFoundError } from "@/domain/errors/AppError";

export interface SharePropertyInput {
  propertyId: string;
  toPhone: string;
  frontendBaseUrl: string;
}

/** "Share property" (Phase 5 Part 4): sends a link to the listing to an
 * arbitrary phone number -- the recipient doesn't need a RentIt account,
 * unlike ContactOwnerUseCase which always targets the listing's owner. */
export class SharePropertyUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly whatsAppService: IWhatsAppService,
  ) {}

  async execute(input: SharePropertyInput): Promise<void> {
    const property = await this.propertyRepo.findById(input.propertyId);
    if (!property || property.deletedAt) {
      throw new NotFoundError("Property not found");
    }

    const url = `${input.frontendBaseUrl.replace(/\/$/, "")}/properties/${property.id}`;

    await this.whatsAppService.sendTemplate({
      to: input.toPhone,
      template: "share_property",
      params: [property.title, url],
    });
  }
}
