import { Pool } from "pg";
import {
  ActivityLogEntry,
  ActivityLogRecord,
  IActivityLogRepository,
} from "@/domain/repositories/IActivityLogRepository";

interface ActivityLogRow {
  id: string;
  user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

function toEntity(row: ActivityLogRow): ActivityLogRecord {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export class ActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(entry: ActivityLogEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO activity_logs (user_id, action, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        entry.userId ?? null,
        entry.action,
        JSON.stringify(entry.metadata ?? {}),
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ],
    );
  }

  async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: ActivityLogRecord[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<ActivityLogRow>(
        `SELECT * FROM activity_logs WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM activity_logs WHERE user_id = $1",
        [userId],
      ),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
