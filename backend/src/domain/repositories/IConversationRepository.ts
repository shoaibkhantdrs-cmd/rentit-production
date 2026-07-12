import { Conversation, ConversationWithParticipants } from "@/domain/entities/Conversation";

export interface ConversationListItem {
  conversation: ConversationWithParticipants;
  otherParticipantId: string | null;
  unreadCount: number;
}

export interface IConversationRepository {
  /** Finds the existing 1:1 conversation between exactly these two users
   * for this property (property may be null for a general, non-property
   * chat), if one already exists -- used so "start a conversation" is
   * idempotent instead of spawning duplicate threads every time either
   * side clicks "message". */
  findDirect(userIdA: string, userIdB: string, propertyId: string | null): Promise<Conversation | null>;
  create(participantIds: [string, string], propertyId: string | null): Promise<ConversationWithParticipants>;
  findById(id: string): Promise<ConversationWithParticipants | null>;
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  listParticipantIds(conversationId: string): Promise<string[]>;
  listForUser(userId: string, page: number, pageSize: number): Promise<{ items: ConversationListItem[]; total: number }>;
  markRead(conversationId: string, userId: string, at: Date): Promise<void>;
  getLastReadAt(conversationId: string, userId: string): Promise<Date | null>;
  touchLastMessage(conversationId: string, preview: string, at: Date): Promise<void>;
  countUnreadForUser(userId: string): Promise<number>;
}
