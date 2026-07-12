import { Pool } from "pg";
import {
  ConversationListItem,
  IConversationRepository,
} from "@/domain/repositories/IConversationRepository";
import { Conversation, ConversationWithParticipants } from "@/domain/entities/Conversation";

interface ConversationRow {
  id: string;
  property_id: string | null;
  last_message_at: Date | null;
  last_message_preview: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: ConversationRow): Conversation {
  return {
    id: row.id,
    propertyId: row.property_id,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class ConversationRepository implements IConversationRepository {
  constructor(private readonly pool: Pool) {}

  async findDirect(
    userIdA: string,
    userIdB: string,
    propertyId: string | null,
  ): Promise<Conversation | null> {
    const result = await this.pool.query<ConversationRow>(
      `SELECT c.* FROM conversations c
       WHERE c.deleted_at IS NULL
         AND c.property_id IS NOT DISTINCT FROM $3
         AND EXISTS (
           SELECT 1 FROM conversation_participants cp
           WHERE cp.conversation_id = c.id AND cp.user_id = $1
         )
         AND EXISTS (
           SELECT 1 FROM conversation_participants cp
           WHERE cp.conversation_id = c.id AND cp.user_id = $2
         )
         AND (SELECT COUNT(*) FROM conversation_participants cp WHERE cp.conversation_id = c.id) = 2
       LIMIT 1`,
      [userIdA, userIdB, propertyId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async create(
    participantIds: [string, string],
    propertyId: string | null,
  ): Promise<ConversationWithParticipants> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<ConversationRow>(
        `INSERT INTO conversations (property_id) VALUES ($1) RETURNING *`,
        [propertyId],
      );
      const conversation = inserted.rows[0];
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversation.id, participantIds[0], participantIds[1]],
      );
      await client.query("COMMIT");
      return { ...toEntity(conversation), participantIds: [...participantIds] };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<ConversationWithParticipants | null> {
    const result = await this.pool.query<ConversationRow>(
      `SELECT * FROM conversations WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!result.rows[0]) return null;

    const participants = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [id],
    );

    return {
      ...toEntity(result.rows[0]),
      participantIds: participants.rows.map((row) => row.user_id),
    };
  }

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2
       ) AS exists`,
      [conversationId, userId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async listParticipantIds(conversationId: string): Promise<string[]> {
    const result = await this.pool.query<{ user_id: string }>(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [conversationId],
    );
    return result.rows.map((row) => row.user_id);
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ConversationListItem[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [rows, count] = await Promise.all([
      this.pool.query<
        ConversationRow & { my_last_read_at: Date | null; other_participant_id: string | null; unread_count: string }
      >(
        `WITH my_convos AS (
           SELECT c.*, cp.last_read_at AS my_last_read_at
           FROM conversations c
           JOIN conversation_participants cp
             ON cp.conversation_id = c.id AND cp.user_id = $1
           WHERE c.deleted_at IS NULL
         )
         SELECT
           mc.*,
           (
             SELECT cp2.user_id FROM conversation_participants cp2
             WHERE cp2.conversation_id = mc.id AND cp2.user_id != $1
             LIMIT 1
           ) AS other_participant_id,
           (
             SELECT COUNT(*) FROM messages m
             WHERE m.conversation_id = mc.id
               AND m.deleted_at IS NULL
               AND m.sender_id != $1
               AND m.created_at > COALESCE(mc.my_last_read_at, '-infinity')
           ) AS unread_count
         FROM my_convos mc
         ORDER BY mc.last_message_at DESC NULLS LAST, mc.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
         WHERE c.deleted_at IS NULL`,
        [userId],
      ),
    ]);

    const items: ConversationListItem[] = rows.rows.map((row) => ({
      conversation: { ...toEntity(row), participantIds: [] },
      otherParticipantId: row.other_participant_id,
      unreadCount: parseInt(row.unread_count, 10),
    }));

    return { items, total: parseInt(count.rows[0].count, 10) };
  }

  async markRead(conversationId: string, userId: string, at: Date): Promise<void> {
    await this.pool.query(
      `UPDATE conversation_participants SET last_read_at = $3
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId, at],
    );
  }

  async getLastReadAt(conversationId: string, userId: string): Promise<Date | null> {
    const result = await this.pool.query<{ last_read_at: Date | null }>(
      `SELECT last_read_at FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId],
    );
    return result.rows[0]?.last_read_at ?? null;
  }

  async touchLastMessage(conversationId: string, preview: string, at: Date): Promise<void> {
    await this.pool.query(
      `UPDATE conversations SET last_message_at = $2, last_message_preview = $3 WHERE id = $1`,
      [conversationId, at, preview],
    );
  }

  async countUnreadForUser(userId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM messages m
       JOIN conversations c ON c.id = m.conversation_id AND c.deleted_at IS NULL
       JOIN conversation_participants cp
         ON cp.conversation_id = m.conversation_id AND cp.user_id = $1
       WHERE m.deleted_at IS NULL
         AND m.sender_id != $1
         AND m.created_at > COALESCE(cp.last_read_at, '-infinity')`,
      [userId],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
