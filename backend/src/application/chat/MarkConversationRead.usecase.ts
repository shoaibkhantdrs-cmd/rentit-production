import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IRealtimeGateway } from "@/domain/services/IRealtimeGateway";
import { IClock } from "@/domain/services/IClock";
import { assertParticipant } from "./shared/assertParticipant";

export interface MarkConversationReadInput {
  conversationId: string;
  userId: string;
}

export class MarkConversationReadUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly realtimeGateway: IRealtimeGateway,
    private readonly clock: IClock,
  ) {}

  async execute(input: MarkConversationReadInput): Promise<void> {
    await assertParticipant(this.conversationRepo, input.conversationId, input.userId);

    const now = this.clock.now();
    await this.conversationRepo.markRead(input.conversationId, input.userId, now);

    const participantIds = await this.conversationRepo.listParticipantIds(input.conversationId);
    const others = participantIds.filter((id) => id !== input.userId);
    this.realtimeGateway.publishToConversation(input.conversationId, others, {
      type: "conversation.read",
      conversationId: input.conversationId,
      userId: input.userId,
      at: now.toISOString(),
    });
  }
}
