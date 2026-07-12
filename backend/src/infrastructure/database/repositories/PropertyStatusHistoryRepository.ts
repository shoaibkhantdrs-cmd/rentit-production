import { Pool } from "pg";
import {
  IPropertyStatusHistoryRepository,
  PropertyStatusHistoryRecord,
  RecordPropertyStatusChangeInput,
} from "@/domain/repositories/IPropertyStatusHistoryRepository";

interface PropertyStatusHistoryRow {
  id: string;
  property_id: string;
  previous_status: PropertyStatusHistoryRecord["previousStatus"];
  new_status: PropertyStatusHistoryRecord["newStatus"];
  changed_by: string | null;
  reason: string | null;
  created_at: Date;
}

function toEntity(row: PropertyStatusHistoryRow): PropertyStatusHistoryRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    changedBy: row.changed_by,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class PropertyStatusHistoryRepository implements IPropertyStatusHistoryRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: RecordPropertyStatusChangeInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO property_status_history (property_id, previous_status, new_status, changed_by, reason)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        input.propertyId,
        input.previousStatus,
        input.newStatus,
        input.changedBy,
        input.reason ?? null,
      ],
    );
  }

  async listForProperty(
    propertyId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: PropertyStatusHistoryRecord[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PropertyStatusHistoryRow>(
        `SELECT * FROM property_status_history WHERE property_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [propertyId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM property_status_history WHERE property_id = $1",
        [propertyId],
      ),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async listRecent(page: number, pageSize: number): Promise<{ items: PropertyStatusHistoryRecord[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PropertyStatusHistoryRow>(
        "SELECT * FROM property_status_history ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        [pageSize, offset],
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*) FROM property_status_history"),
    ]);
    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
