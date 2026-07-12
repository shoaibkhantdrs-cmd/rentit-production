import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IMessageRepository } from "@/domain/repositories/IMessageRepository";
import { assertParticipant } from "./shared/assertParticipant";

export interface ListMessagesInput {
  conversationId: string;
  requesterId: string;
  page: number;
  pageSize: number;
}

export interface MessageDto {
  id: string;
  senderId: string;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  isMine: boolean;
  isDeleted: boolean;
  readByOther: boolean;
}

export class ListMessagesUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly messageRepo: IMessageRepository,
  ) {}

  async execute(input: ListMessagesInput) {
    await assertParticipant(this.conversationRepo, input.conversationId, input.requesterId);

    const { items, total } = await this.messageRepo.listForConversation(
      input.conversationId,
      input.page,
      input.pageSize,
    );

    const participantIds = await this.conversationRepo.listParticipantIds(input.conversationId);
    const otherId = participantIds.find((id) => id !== input.requesterId) ?? null;
    const otherLastReadAt = otherId
      ? await this.conversationRepo.getLastReadAt(input.conversationId, otherId)
      : null;

    const dtos: MessageDto[] = items.map((message) => {
      const isDeleted = message.deletedAt !== null;
      return {
        id: message.id,
        senderId: message.senderId,
        body: isDeleted ? null : message.body,
        imageUrl: isDeleted ? null : message.imageUrl,
        createdAt: message.createdAt.toISOString(),
        isMine: message.senderId === input.requesterId,
        isDeleted,
        readByOther:
          message.senderId === input.requesterId &&
          otherLastReadAt !== null &&
          otherLastReadAt.getTime() >= message.createdAt.getTime(),
      };
    });

    return { items: dtos, total, page: input.page, pageSize: input.pageSize };
  }
}
