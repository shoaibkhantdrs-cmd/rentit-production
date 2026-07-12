import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

export interface StartConversationInput {
  initiatorId: string;
  recipientId: string;
  propertyId?: string | null;
}

/**
 * Idempotent by design: re-"starting" a conversation that already exists
 * between these two people (about the same property, or the same general
 * thread if propertyId is omitted both times) just returns it, so a user
 * clicking "Message owner" twice never spawns duplicate threads.
 */
export class StartConversationUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly userRepo: IUserRepository,
    private readonly propertyRepo: IPropertyRepository,
  ) {}

  async execute(input: StartConversationInput) {
    if (input.initiatorId === input.recipientId) {
      throw new ValidationError("You cannot start a conversation with yourself");
    }

    const recipient = await this.userRepo.findById(input.recipientId);
    if (!recipient || recipient.deletedAt) {
      throw new NotFoundError("User not found");
    }
    if (recipient.status !== "active") {
      throw new ConflictError("This user is not able to receive messages right now");
    }

    const propertyId = input.propertyId ?? null;
    if (propertyId) {
      const property = await this.propertyRepo.findById(propertyId);
      if (!property || property.deletedAt) {
        throw new NotFoundError("Property not found");
      }
    }

    const existing = await this.conversationRepo.findDirect(
      input.initiatorId,
      input.recipientId,
      propertyId,
    );
    if (existing) {
      return this.conversationRepo.findById(existing.id);
    }

    return this.conversationRepo.create([input.initiatorId, input.recipientId], propertyId);
  }
}
