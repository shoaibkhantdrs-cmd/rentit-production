import { IConversationRepository } from "@/domain/repositories/IConversationRepository";
import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";

export interface ListConversationsInput {
  userId: string;
  page: number;
  pageSize: number;
}

export interface ConversationSummary {
  id: string;
  propertyId: string | null;
  propertyTitle: string | null;
  otherParticipant: { id: string; name: string } | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/**
 * Composes the raw conversation-list rows with the other participant's
 * name and the property's title, the same "load the aggregate, then
 * resolve display fields" shape as PropertyDetailLoader in Phase 3 --
 * keeps IConversationRepository itself free of joins across users/properties.
 */
export class ListConversationsUseCase {
  constructor(
    private readonly conversationRepo: IConversationRepository,
    private readonly userRepo: IUserRepository,
    private readonly propertyRepo: IPropertyRepository,
  ) {}

  async execute(input: ListConversationsInput) {
    const { items, total } = await this.conversationRepo.listForUser(
      input.userId,
      input.page,
      input.pageSize,
    );

    const summaries: ConversationSummary[] = await Promise.all(
      items.map(async (item) => {
        const other = item.otherParticipantId
          ? await this.userRepo.findById(item.otherParticipantId)
          : null;
        const property = item.conversation.propertyId
          ? await this.propertyRepo.findById(item.conversation.propertyId)
          : null;

        return {
          id: item.conversation.id,
          propertyId: item.conversation.propertyId,
          propertyTitle: property?.title ?? null,
          otherParticipant: other ? { id: other.id, name: other.name } : null,
          lastMessagePreview: item.conversation.lastMessagePreview,
          lastMessageAt: item.conversation.lastMessageAt?.toISOString() ?? null,
          unreadCount: item.unreadCount,
        };
      }),
    );

    return { items: summaries, total, page: input.page, pageSize: input.pageSize };
  }
}
