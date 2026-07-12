import { Message, NewMessage } from "@/domain/entities/Message";

export interface IMessageRepository {
  create(input: NewMessage): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  listForConversation(
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Message[]; total: number }>;
  softDelete(id: string): Promise<void>;
}
