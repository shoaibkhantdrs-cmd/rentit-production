import { Pool } from "pg";
import {
  AuditLogEntry,
  AuditLogRecord,
  AuditLogSearchFilters,
  IAuditLogRepository,
} from "@/domain/repositories/IAuditLogRepository";

interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toEntity(row: AuditLogRow): AuditLogRecord {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(entry: AuditLogEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.entityType ?? null,
        entry.entityId ?? null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    );
  }

  async search(
    filters: AuditLogSearchFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: AuditLogRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${i}`);
      values.push(filters.userId);
      i += 1;
    }
    if (filters.action) {
      conditions.push(`action = $${i}`);
      values.push(filters.action);
      i += 1;
    }
    if (filters.entityType) {
      conditions.push(`entity_type = $${i}`);
      values.push(filters.entityType);
      i += 1;
    }
    if (filters.entityId) {
      conditions.push(`entity_id = $${i}`);
      values.push(filters.entityId);
      i += 1;
    }
    if (filters.dateFrom) {
      conditions.push(`created_at >= $${i}`);
      values.push(filters.dateFrom);
      i += 1;
    }
    if (filters.dateTo) {
      conditions.push(`created_at <= $${i}`);
      values.push(filters.dateTo);
      i += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<AuditLogRow>(
        `SELECT * FROM audit_logs ${whereClause}
         ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*) FROM audit_logs ${whereClause}`, values),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
