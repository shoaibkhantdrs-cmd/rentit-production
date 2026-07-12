import { Message } from "@/domain/entities/Message";

export type ChatRealtimeEvent =
  | { type: "message.new"; conversationId: string; message: Message }
  | { type: "message.deleted"; conversationId: string; messageId: string }
  | { type: "typing"; conversationId: string; userId: string; isTyping: boolean }
  | { type: "conversation.read"; conversationId: string; userId: string; at: string };

/**
 * Port over whatever transport actually pushes real-time events to
 * connected clients (a WebSocket server in this codebase -- see
 * infrastructure/realtime/WebSocketGateway.ts). Application use-cases
 * depend only on this interface, so the chat use-cases stay entirely
 * transport-agnostic and testable with an in-memory fake, exactly like
 * every other port in this codebase (INotificationSender, IPushNotificationService, ...).
 */
export interface IRealtimeGateway {
  /** Delivers an event to every participant of a conversation who is
   * currently connected. Never throws -- a disconnected/absent recipient
   * is not an error, they'll pick the change up on next poll/reconnect. */
  publishToConversation(conversationId: string, recipientUserIds: string[], event: ChatRealtimeEvent): void;
}
