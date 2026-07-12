import { IConversationRepository } from "@/domain/repositories/IConversationRepository";

/** Backs the chat badge in the frontend nav -- a single lightweight count
 * across every conversation, separate from ListConversationsUseCase so the
 * frontend can poll/display it without paginating the full list. */
export class GetUnreadMessageCountUseCase {
  constructor(private readonly conversationRepo: IConversationRepository) {}

  async execute(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.conversationRepo.countUnreadForUser(userId);
    return { unreadCount };
  }
}
