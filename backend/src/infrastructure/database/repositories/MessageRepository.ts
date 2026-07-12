import { Pool } from "pg";
import { IMessageRepository } from "@/domain/repositories/IMessageRepository";
import { Message, NewMessage } from "@/domain/entities/Message";

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  image_public_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    imageUrl: row.image_url,
    imagePublicId: row.image_public_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class MessageRepository implements IMessageRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewMessage): Promise<Message> {
    const result = await this.pool.query<MessageRow>(
      `INSERT INTO messages (conversation_id, sender_id, body, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        input.conversationId,
        input.senderId,
        input.body ?? null,
        input.imageUrl ?? null,
        input.imagePublicId ?? null,
      ],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Message | null> {
    const result = await this.pool.query<MessageRow>(`SELECT * FROM messages WHERE id = $1`, [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async listForConversation(
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Message[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [rows, count] = await Promise.all([
      this.pool.query<MessageRow>(
        `SELECT * FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [conversationId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM messages WHERE conversation_id = $1`,
        [conversationId],
      ),
    ]);

    return {
      items: rows.rows.map(toEntity).reverse(), // oldest-first within the page, newest page first
      total: parseInt(count.rows[0].count, 10),
    };
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(`UPDATE messages SET deleted_at = now() WHERE id = $1`, [id]);
  }
}
