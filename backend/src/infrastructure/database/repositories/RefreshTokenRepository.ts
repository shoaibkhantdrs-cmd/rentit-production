import { Pool } from "pg";
import {
  IRefreshTokenRepository,
  NewRefreshTokenInput,
} from "@/domain/repositories/IRefreshTokenRepository";
import { RefreshToken } from "@/domain/entities/RefreshToken";

interface RefreshTokenRow {
  id: string;
  user_id: string;
  session_id: string;
  token_hash: string;
  family_id: string;
  replaced_by: string | null;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
}

function toEntity(row: RefreshTokenRow): RefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    tokenHash: row.token_hash,
    familyId: row.family_id,
    replacedBy: row.replaced_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
  };
}

export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewRefreshTokenInput): Promise<RefreshToken> {
    const result = await this.pool.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, session_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.userId, input.sessionId, input.tokenHash, input.familyId, input.expiresAt],
    );
    return toEntity(result.rows[0]);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.pool.query<RefreshTokenRow>(
      "SELECT * FROM refresh_tokens WHERE token_hash = $1",
      [tokenHash],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async markReplaced(id: string, replacedById: string): Promise<void> {
    await this.pool.query("UPDATE refresh_tokens SET replaced_by = $2 WHERE id = $1", [
      id,
      replacedById,
    ]);
  }

  async revoke(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $2
       WHERE id = $1 AND revoked_at IS NULL`,
      [id, reason],
    );
  }

  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $2
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId, reason],
    );
  }

  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $2
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId, reason],
    );
    return result.rowCount ?? 0;
  }
}
