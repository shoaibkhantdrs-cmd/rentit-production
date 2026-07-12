import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IRealtimeGateway } from "@/domain/services/IRealtimeGateway";
import { assertParticipant } from "./shared/assertParticipant";

export interface SendTypingIndicatorInput {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

/** Deliberately not persisted anywhere -- typing state is purely
 * transient, so this use-case's only job is "verify the sender is
 * actually allowed in this conversation" before fanning the event out
 * over the realtime gateway. */
export class SendTypingIndicatorUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly realtimeGateway: IRealtimeGateway,
  ) {}

  async execute(input: SendTypingIndicatorInput): Promise<void> {
    await assertParticipant(this.conversationRepo, input.conversationId, input.userId);

    const participantIds = await this.conversationRepo.listParticipantIds(input.conversationId);
    const others = participantIds.filter((id) => id !== input.userId);
    this.realtimeGateway.publishToConversation(input.conversationId, others, {
      type: "typing",
      conversationId: input.conversationId,
      userId: input.userId,
      isTyping: input.isTyping,
    });
  }
}
