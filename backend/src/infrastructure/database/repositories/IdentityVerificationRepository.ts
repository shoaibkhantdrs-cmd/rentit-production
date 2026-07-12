import { Pool } from "pg";
import {
  IIdentityVerificationRepository,
  IdentityVerificationListFilters,
  NewIdentityVerificationInput,
} from "@/domain/repositories/IIdentityVerificationRepository";
import { IdentityVerification, IdentityVerificationStatus } from "@/domain/entities/IdentityVerification";

interface IdentityVerificationRow {
  id: string;
  user_id: string;
  document_type: IdentityVerification["documentType"];
  document_image_url: string;
  status: IdentityVerification["status"];
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: IdentityVerificationRow): IdentityVerification {
  return {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type,
    documentImageUrl: row.document_image_url,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class IdentityVerificationRepository implements IIdentityVerificationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewIdentityVerificationInput): Promise<IdentityVerification> {
    const result = await this.pool.query<IdentityVerificationRow>(
      `INSERT INTO identity_verifications (user_id, document_type, document_image_url)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [input.userId, input.documentType, input.documentImageUrl],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<IdentityVerification | null> {
    const result = await this.pool.query<IdentityVerificationRow>(
      "SELECT * FROM identity_verifications WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findLatestForUser(userId: string): Promise<IdentityVerification | null> {
    const result = await this.pool.query<IdentityVerificationRow>(
      "SELECT * FROM identity_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async list(
    filters: IdentityVerificationListFilters,
    page: number,
    pageSize: number,
  ): Promise<{ items: IdentityVerification[]; total: number }> {
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
      this.pool.query<IdentityVerificationRow>(
        `SELECT * FROM identity_verifications ${whereClause}
         ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
        [...values, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM identity_verifications ${whereClause}`,
        values,
      ),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async updateStatus(
    id: string,
    status: IdentityVerificationStatus,
    reviewedBy: string,
    rejectionReason?: string | null,
  ): Promise<IdentityVerification> {
    const result = await this.pool.query<IdentityVerificationRow>(
      `UPDATE identity_verifications
       SET status = $2, reviewed_by = $3, reviewed_at = now(), rejection_reason = $4
       WHERE id = $1 RETURNING *`,
      [id, status, reviewedBy, rejectionReason ?? null],
    );
    if (!result.rows[0]) throw new Error(`Identity verification ${id} not found`);
    return toEntity(result.rows[0]);
  }

  async countByStatus(status: IdentityVerificationStatus): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM identity_verifications WHERE status = $1",
      [status],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
