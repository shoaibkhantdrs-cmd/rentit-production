import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IMessageRepository } from "@/domain/repositories/IMessageRepository";
import { IRealtimeGateway } from "@/domain/services/IRealtimeGateway";
import { ForbiddenError, NotFoundError } from "@/domain/errors/AppError";

export interface DeleteMessageInput {
  conversationId: string;
  messageId: string;
  requesterId: string;
}

/** Soft delete, sender-only: mirrors every other soft delete in this
 * codebase (properties, users, saved searches, ...) -- the row stays so
 * conversation history doesn't develop holes, but its content is hidden
 * from every reader (see ListMessagesUseCase). */
export class DeleteMessageUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly messageRepo: IMessageRepository,
    private readonly realtimeGateway: IRealtimeGateway,
  ) {}

  async execute(input: DeleteMessageInput): Promise<void> {
    const message = await this.messageRepo.findById(input.messageId);
    if (!message || message.conversationId !== input.conversationId || message.deletedAt) {
      throw new NotFoundError("Message not found");
    }
    if (message.senderId !== input.requesterId) {
      throw new ForbiddenError("You can only delete your own messages");
    }

    await this.messageRepo.softDelete(input.messageId);

    const participantIds = await this.conversationRepo.listParticipantIds(input.conversationId);
    const others = participantIds.filter((id) => id !== input.requesterId);
    this.realtimeGateway.publishToConversation(input.conversationId, others, {
      type: "message.deleted",
      conversationId: input.conversationId,
      messageId: input.messageId,
    });
  }
}
