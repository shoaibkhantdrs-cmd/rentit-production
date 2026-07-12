import { randomUUID } from "crypto";
import {
  ConversationListItem,
  IConversationRepository,
} from "@/domain/repositories/IConversationRepository";
import { Conversation, ConversationWithParticipants } from "@/domain/entities/Conversation";
import { InMemoryMessageRepository } from "./InMemoryMessageRepository";

interface ParticipantRow {
  userId: string;
  lastReadAt: Date | null;
}

export class InMemoryConversationRepository implements IConversationRepository {
  private readonly conversations = new Map<string, Conversation>();
  private readonly participants = new Map<string, ParticipantRow[]>();

  /** Needs the same message store the real Postgres query joins against
   * to compute unread counts -- mirrors how InMemoryAdminAnalyticsRepository
   * (Phase 4) reads across other fakes' public state instead of
   * duplicating message storage here. */
  constructor(private readonly messageRepo: InMemoryMessageRepository) {}

  async findDirect(
    userIdA: string,
    userIdB: string,
    propertyId: string | null,
  ): Promise<Conversation | null> {
    for (const [id, rows] of this.participants.entries()) {
      const ids = rows.map((r) => r.userId);
      if (ids.length !== 2) continue;
      if (!ids.includes(userIdA) || !ids.includes(userIdB)) continue;
      const conversation = this.conversations.get(id);
      if (!conversation || conversation.deletedAt) continue;
      if (conversation.propertyId !== propertyId) continue;
      return conversation;
    }
    return null;
  }

  async create(
    participantIds: [string, string],
    propertyId: string | null,
  ): Promise<ConversationWithParticipants> {
    const now = new Date();
    const conversation: Conversation = {
      id: randomUUID(),
      propertyId,
      lastMessageAt: null,
      lastMessagePreview: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.conversations.set(conversation.id, conversation);
    this.participants.set(
      conversation.id,
      participantIds.map((userId) => ({ userId, lastReadAt: null })),
    );
    return { ...conversation, participantIds: [...participantIds] };
  }

  async findById(id: string): Promise<ConversationWithParticipants | null> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.deletedAt) return null;
    const rows = this.participants.get(id) ?? [];
    return { ...conversation, participantIds: rows.map((r) => r.userId) };
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const rows = this.participants.get(conversationId) ?? [];
    return rows.some((r) => r.userId === userId);
  }

  async listParticipantIds(conversationId: string): Promise<string[]> {
    return (this.participants.get(conversationId) ?? []).map((r) => r.userId);
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ConversationListItem[]; total: number }> {
    const mine = [...this.conversations.values()].filter((c) => {
      if (c.deletedAt) return false;
      const rows = this.participants.get(c.id) ?? [];
      return rows.some((r) => r.userId === userId);
    });

    mine.sort((a, b) => {
      const at = a.lastMessageAt?.getTime() ?? -Infinity;
      const bt = b.lastMessageAt?.getTime() ?? -Infinity;
      if (bt !== at) return bt - at;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const start = (page - 1) * pageSize;
    const pageItems = mine.slice(start, start + pageSize);

    const items: ConversationListItem[] = pageItems.map((conversation) => {
      const rows = this.participants.get(conversation.id) ?? [];
      const mineRow = rows.find((r) => r.userId === userId) ?? null;
      const other = rows.find((r) => r.userId !== userId) ?? null;
      const unreadCount = this.messageRepo.messages.filter(
        (m) =>
          m.conversationId === conversation.id &&
          !m.deletedAt &&
          m.senderId !== userId &&
          m.createdAt.getTime() > (mineRow?.lastReadAt?.getTime() ?? -Infinity),
      ).length;

      return {
        conversation: { ...conversation, participantIds: rows.map((r) => r.userId) },
        otherParticipantId: other?.userId ?? null,
        unreadCount,
      };
    });

    return { items, total: mine.length };
  }

  async markRead(conversationId: string, userId: string, at: Date): Promise<void> {
    const rows = this.participants.get(conversationId) ?? [];
    const row = rows.find((r) => r.userId === userId);
    if (row) row.lastReadAt = at;
  }

  async getLastReadAt(conversationId: string, userId: string): Promise<Date | null> {
    const rows = this.participants.get(conversationId) ?? [];
    return rows.find((r) => r.userId === userId)?.lastReadAt ?? null;
  }

  async touchLastMessage(conversationId: string, preview: string, at: Date): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    conversation.lastMessageAt = at;
    conversation.lastMessagePreview = preview;
  }

  async countUnreadForUser(userId: string): Promise<number> {
    let count = 0;
    for (const [conversationId, rows] of this.participants.entries()) {
      const conversation = this.conversations.get(conversationId);
      if (!conversation || conversation.deletedAt) continue;
      const mineRow = rows.find((r) => r.userId === userId);
      if (!mineRow) continue;
      count += this.messageRepo.messages.filter(
        (m) =>
          m.conversationId === conversationId &&
          !m.deletedAt &&
          m.senderId !== userId &&
          m.createdAt.getTime() > (mineRow.lastReadAt?.getTime() ?? -Infinity),
      ).length;
    }
    return count;
  }
}
