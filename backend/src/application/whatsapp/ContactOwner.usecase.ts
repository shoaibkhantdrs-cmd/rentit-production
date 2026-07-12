import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IWhatsAppService } from "@/domain/services/IWhatsAppService";
import { resolvePropertyAndOwner } from "./shared/resolveOwnerPhone";

export interface ContactOwnerInput {
  propertyId: string;
  requesterId: string;
}

/** "Contact owner" (Phase 5 Part 4): notifies the owner over WhatsApp that
 * someone is interested, using the contact_owner template. This is a
 * lighter-weight alternative to starting a full in-app chat thread
 * (StartConversationUseCase) -- some owners would rather get a WhatsApp
 * ping than watch the RentIt inbox. */
export class ContactOwnerUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly userRepo: IUserRepository,
    private readonly whatsAppService: IWhatsAppService,
  ) {}

  async execute(input: ContactOwnerInput): Promise<void> {
    const { property, owner } = await resolvePropertyAndOwner(
      this.propertyRepo,
      this.userRepo,
      input.propertyId,
    );
    const requester = await this.userRepo.findById(input.requesterId);

    await this.whatsAppService.sendTemplate({
      to: owner.phone as string,
      template: "contact_owner",
      params: [requester?.name ?? "A RentIt user", property.title],
    });
  }
}
