import { randomUUID } from "crypto";
import { IMessageRepository } from "@/domain/repositories/IMessageRepository";
import { Message, NewMessage } from "@/domain/entities/Message";
import { IClock } from "@/domain/services/IClock";

export class InMemoryMessageRepository implements IMessageRepository {
  public readonly messages: Message[] = [];

  /** Takes the same injected clock every other timestamped fake in this
   * test suite uses (InMemoryPropertyViewRepository, etc.) -- without it,
   * a message's real-wall-clock createdAt could never line up with a
   * MarkConversationReadUseCase call driven by a FakeClock frozen at a
   * fixed instant, making unread-count assertions flaky by construction. */
  constructor(private readonly clock: IClock) {}

  async create(input: NewMessage): Promise<Message> {
    const now = this.clock.now();
    const message: Message = {
      id: randomUUID(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body ?? null,
      imageUrl: input.imageUrl ?? null,
      imagePublicId: input.imagePublicId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.messages.push(message);
    return message;
  }

  async findById(id: string): Promise<Message | null> {
    return this.messages.find((m) => m.id === id) ?? null;
  }

  async listForConversation(
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Message[]; total: number }> {
    const all = this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * pageSize;
    const page_ = all.slice(start, start + pageSize).reverse();

    return { items: page_, total: all.length };
  }

  async softDelete(id: string): Promise<void> {
    const message = this.messages.find((m) => m.id === id);
    if (message) message.deletedAt = new Date();
  }
}
