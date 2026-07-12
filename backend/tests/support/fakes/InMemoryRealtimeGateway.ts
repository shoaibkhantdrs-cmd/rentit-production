import { ChatRealtimeEvent, IRealtimeGateway } from "@/domain/services/IRealtimeGateway";

export interface PublishedEvent {
  conversationId: string;
  recipientUserIds: string[];
  event: ChatRealtimeEvent;
}

export class InMemoryRealtimeGateway implements IRealtimeGateway {
  public readonly published: PublishedEvent[] = [];

  publishToConversation(
    conversationId: string,
    recipientUserIds: string[],
    event: ChatRealtimeEvent,
  ): void {
    this.published.push({ conversationId, recipientUserIds, event });
  }
}
