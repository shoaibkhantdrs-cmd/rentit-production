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

    // Perf fix: was 2 extra queries per row (findById for the other
    // participant + findById for the property) -- up to ~200 extra round
    // trips on a full 100-item page. Batch both instead, mirroring the
    // same Map-join pattern PropertyDetailLoader.loadMany() and
    // SearchProperties.usecase.ts already use.
    const otherParticipantIds = [
      ...new Set(items.map((item) => item.otherParticipantId).filter((id): id is string => id !== null)),
    ];
    const propertyIds = [
      ...new Set(
        items.map((item) => item.conversation.propertyId).filter((id): id is string => id !== null),
      ),
    ];

    const [otherUsers, properties] = await Promise.all([
      this.userRepo.findManyByIds(otherParticipantIds),
      this.propertyRepo.findManyByIds(propertyIds),
    ]);

    const userById = new Map(otherUsers.map((u) => [u.id, u]));
    const propertyById = new Map(properties.map((p) => [p.id, p]));

    const summaries: ConversationSummary[] = items.map((item) => {
      const other = item.otherParticipantId ? (userById.get(item.otherParticipantId) ?? null) : null;
      const property = item.conversation.propertyId
        ? (propertyById.get(item.conversation.propertyId) ?? null)
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
    });

    return { items: summaries, total, page: input.page, pageSize: input.pageSize };
  }
}
