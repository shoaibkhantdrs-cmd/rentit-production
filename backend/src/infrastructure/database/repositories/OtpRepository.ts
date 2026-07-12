import { Pool } from "pg";
import { IOtpRepository, NewOtpInput } from "@/domain/repositories/IOtpRepository";
import { OtpCode, OtpPurpose } from "@/domain/entities/OtpCode";

interface OtpCodeRow {
  id: string;
  user_id: string;
  purpose: OtpPurpose;
  channel: OtpCode["channel"];
  code_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: OtpCodeRow): OtpCode {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    channel: row.channel,
    codeHash: row.code_hash,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class OtpRepository implements IOtpRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewOtpInput): Promise<OtpCode> {
    const result = await this.pool.query<OtpCodeRow>(
      `INSERT INTO otp_codes (user_id, purpose, channel, code_hash, max_attempts, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.userId, input.purpose, input.channel, input.codeHash, input.maxAttempts, input.expiresAt],
    );
    return toEntity(result.rows[0]);
  }

  async findActive(userId: string, purpose: OtpPurpose): Promise<OtpCode | null> {
    const result = await this.pool.query<OtpCodeRow>(
      `SELECT * FROM otp_codes
       WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, purpose],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async incrementAttempts(id: string): Promise<OtpCode> {
    const result = await this.pool.query<OtpCodeRow>(
      "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1 RETURNING *",
      [id],
    );
    return toEntity(result.rows[0]);
  }

  async consume(id: string): Promise<void> {
    await this.pool.query("UPDATE otp_codes SET consumed_at = now() WHERE id = $1", [id]);
  }
}
