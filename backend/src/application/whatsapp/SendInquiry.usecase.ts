import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IWhatsAppService } from "@/domain/services/IWhatsAppService";
import { ValidationError } from "@/domain/errors/AppError";
import { resolvePropertyAndOwner } from "./shared/resolveOwnerPhone";

export interface SendInquiryInput {
  propertyId: string;
  requesterId: string;
  message: string;
}

const MAX_MESSAGE_LENGTH = 300;

/** "Send inquiry" (Phase 5 Part 4): like ContactOwnerUseCase but carries a
 * free-text message from the prospective renter, using the send_inquiry
 * template. */
export class SendInquiryUseCase {
  constructor(
    private readonly propertyRepo: IPropertyRepository,
    private readonly userRepo: IUserRepository,
    private readonly whatsAppService: IWhatsAppService,
  ) {}

  async execute(input: SendInquiryInput): Promise<void> {
    const trimmed = input.message.trim();
    if (!trimmed) {
      throw new ValidationError("Inquiry message cannot be empty");
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new ValidationError(`Inquiry message must be ${MAX_MESSAGE_LENGTH} characters or fewer`);
    }

    const { property, owner } = await resolvePropertyAndOwner(
      this.propertyRepo,
      this.userRepo,
      input.propertyId,
    );
    const requester = await this.userRepo.findById(input.requesterId);

    await this.whatsAppService.sendTemplate({
      to: owner.phone as string,
      template: "send_inquiry",
      params: [requester?.name ?? "A RentIt user", property.title, trimmed],
    });
  }
}
