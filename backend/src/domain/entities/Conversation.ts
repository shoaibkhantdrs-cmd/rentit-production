export interface Conversation {
  id: string;
  propertyId: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: Date | null;
  createdAt: Date;
}

/** A conversation plus the caller's own participant row and (optionally)
 * the other participant's id -- the shape the application layer hands to
 * controllers, so the HTTP layer never has to re-derive "who is the other
 * person in this 1:1 thread". */
export interface ConversationWithParticipants extends Conversation {
  participantIds: string[];
}
