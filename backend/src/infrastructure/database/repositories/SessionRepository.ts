import { Pool } from "pg";
import { ISessionRepository, NewSessionInput } from "@/domain/repositories/ISessionRepository";
import { Session } from "@/domain/entities/Session";

interface SessionRow {
  id: string;
  user_id: string;
  device_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
  last_active_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: string | null;
}

function toEntity(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
  };
}

export class SessionRepository implements ISessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewSessionInput): Promise<Session> {
    const result = await this.pool.query<SessionRow>(
      `INSERT INTO sessions (user_id, device_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.userId, input.deviceId, input.ipAddress, input.userAgent, input.expiresAt],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Session | null> {
    const result = await this.pool.query<SessionRow>("SELECT * FROM sessions WHERE id = $1", [
      id,
    ]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async touchLastActive(id: string): Promise<void> {
    await this.pool.query("UPDATE sessions SET last_active_at = now() WHERE id = $1", [id]);
  }

  async revoke(id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
       WHERE id = $1 AND revoked_at IS NULL`,
      [id, reason],
    );
  }

  async revokeAllForUser(
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.pool.query(
      `UPDATE sessions SET revoked_at = now(), revoked_reason = $2
       WHERE user_id = $1 AND revoked_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
      [userId, reason, exceptSessionId ?? null],
    );
    return result.rowCount ?? 0;
  }
}
