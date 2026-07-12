import { Pool } from "pg";
import {
  IPropertyReportRepository,
  NewPropertyReportInput,
  PropertyReportListFilters,
} from "@/domain/repositories/IPropertyReportRepository";
import { PropertyReport, PropertyReportStatus } from "@/domain/entities/PropertyReport";

interface PropertyReportRow {
  id: string;
  property_id: string;
  reporter_user_id: string;
  reason: PropertyReport["reason"];
  details: string | null;
  status: PropertyReport["status"];
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: PropertyReportRow): PropertyReport {
  return {
    id: row.id,
    propertyId: row.property_id,
    reporterUserId: row.reporter_user_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PropertyReportRepository implements IPropertyReportRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewPropertyReportInput): Promise<PropertyReport> {
    const result = await this.pool.query<PropertyReportRow>(
      `INSERT INTO property_reports (property_id, reporter_user_id, reason, details)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [input.propertyId, input.reporterUserId, input.reason, input.details ?? null],
    );
    return toEntity(result.rows[0]);
  }

  async existsForUserAndProperty(propertyId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM property_reports WHERE property_id = $1 AND reporter_user_id = $2) AS exists",
      [propertyId, userId],
    );
    return result.rows[0].exists;
  }

  async findById(id: string): Promise<PropertyReport | null> {
    const result = await this.pool.query<PropertyReportRow>(
      "SELECT * FROM property_reports WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async list(
    filters: PropertyReportListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: PropertyReport[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (filters.status) {
      conditions.push(`status = $${i}`);
      values.push(filters.status);
      i += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PropertyReportRow>(
        `SELECT * FROM property_reports ${whereClause}
         ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*) FROM property_reports ${whereClause}`, values),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async updateStatus(id: string, status: PropertyReportStatus, reviewedBy: string): Promise<PropertyReport> {
    const result = await this.pool.query<PropertyReportRow>(
      `UPDATE property_reports SET status = $2, reviewed_by = $3, reviewed_at = now()
       WHERE id = $1 RETURNING *`,
      [id, status, reviewedBy],
    );
    if (!result.rows[0]) throw new Error(`Property report ${id} not found`);
    return toEntity(result.rows[0]);
  }

  async countByStatus(status: PropertyReportStatus): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM property_reports WHERE status = $1",
      [status],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
