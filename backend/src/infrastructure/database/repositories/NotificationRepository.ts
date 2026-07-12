import { Pool } from "pg";
import {
  INotificationRepository,
  ListNotificationsOptions,
  ListNotificationsResult,
  NewNotificationInput,
} from "@/domain/repositories/INotificationRepository";
import { Notification } from "@/domain/entities/Notification";

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    readAt: row.read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewNotificationInput): Promise<Notification> {
    const result = await this.pool.query<NotificationRow>(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.userId, input.type, input.title, input.body, JSON.stringify(input.data ?? {})],
    );
    return toEntity(result.rows[0]);
  }

  async listForUser(
    userId: string,
    options: ListNotificationsOptions,
  ): Promise<ListNotificationsResult> {
    const offset = (options.page - 1) * options.pageSize;
    const unreadClause = options.unreadOnly ? "AND read_at IS NULL" : "";

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<NotificationRow>(
        `SELECT * FROM notifications
         WHERE user_id = $1 AND deleted_at IS NULL ${unreadClause}
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, options.pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM notifications
         WHERE user_id = $1 AND deleted_at IS NULL ${unreadClause}`,
        [userId],
      ),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    const result = await this.pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL`,
      [userId, ids],
    );
    return result.rowCount ?? 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL`,
      [userId],
    );
    return result.rowCount ?? 0;
  }
}
