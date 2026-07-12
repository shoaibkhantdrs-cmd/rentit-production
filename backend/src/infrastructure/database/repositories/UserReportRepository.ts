import { Pool } from "pg";
import {
  IUserReportRepository,
  NewUserReportInput,
  UserReportListFilters,
} from "@/domain/repositories/IUserReportRepository";
import { UserReport, UserReportStatus } from "@/domain/entities/UserReport";

interface UserReportRow {
  id: string;
  reported_user_id: string;
  reporter_user_id: string;
  reason: UserReport["reason"];
  details: string | null;
  status: UserReport["status"];
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: UserReportRow): UserReport {
  return {
    id: row.id,
    reportedUserId: row.reported_user_id,
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

/** Structural mirror of PropertyReportRepository -- see that file's doc comment. */
export class UserReportRepository implements IUserReportRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewUserReportInput): Promise<UserReport> {
    const result = await this.pool.query<UserReportRow>(
      `INSERT INTO user_reports (reported_user_id, reporter_user_id, reason, details)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [input.reportedUserId, input.reporterUserId, input.reason, input.details ?? null],
    );
    return toEntity(result.rows[0]);
  }

  async existsForUserAndReporter(reportedUserId: string, reporterUserId: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM user_reports WHERE reported_user_id = $1 AND reporter_user_id = $2) AS exists",
      [reportedUserId, reporterUserId],
    );
    return result.rows[0].exists;
  }

  async findById(id: string): Promise<UserReport | null> {
    const result = await this.pool.query<UserReportRow>(
      "SELECT * FROM user_reports WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async list(
    filters: UserReportListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: UserReport[]; total: number }> {
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
      this.pool.query<UserReportRow>(
        `SELECT * FROM user_reports ${whereClause}
         ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(`SELECT COUNT(*) FROM user_reports ${whereClause}`, values),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async updateStatus(id: string, status: UserReportStatus, reviewedBy: string): Promise<UserReport> {
    const result = await this.pool.query<UserReportRow>(
      `UPDATE user_reports SET status = $2, reviewed_by = $3, reviewed_at = now()
       WHERE id = $1 RETURNING *`,
      [id, status, reviewedBy],
    );
    if (!result.rows[0]) throw new Error(`User report ${id} not found`);
    return toEntity(result.rows[0]);
  }

  async countByStatus(status: UserReportStatus): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM user_reports WHERE status = $1",
      [status],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
