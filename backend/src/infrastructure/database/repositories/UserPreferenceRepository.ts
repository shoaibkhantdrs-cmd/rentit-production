import { Pool } from "pg";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { UserPreference } from "@/domain/entities/UserPreference";

interface UserPreferenceRow {
  id: string;
  user_id: string;
  language: string;
  timezone: string;
  notify_email: boolean;
  notify_sms: boolean;
  notify_push: boolean;
  extra: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: UserPreferenceRow): UserPreference {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language,
    timezone: row.timezone,
    notifyEmail: row.notify_email,
    notifySms: row.notify_sms,
    notifyPush: row.notify_push,
    extra: row.extra,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserPreferenceRepository implements IUserPreferenceRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserId(userId: string): Promise<UserPreference | null> {
    const result = await this.pool.query<UserPreferenceRow>(
      "SELECT * FROM user_preferences WHERE user_id = $1",
      [userId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async createDefault(userId: string): Promise<UserPreference> {
    const result = await this.pool.query<UserPreferenceRow>(
      `INSERT INTO user_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING *`,
      [userId],
    );

    if (result.rows[0]) {
      return toEntity(result.rows[0]);
    }

    // Conflict path: row already existed (defensive; createDefault is
    // meant to be called once per new user, but this keeps it idempotent).
    const existing = await this.findByUserId(userId);
    if (!existing) throw new Error(`Failed to create or find preferences for user ${userId}`);
    return existing;
  }

  async update(userId: string, patch: Partial<UserPreference>): Promise<UserPreference> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const columnMap: Record<string, unknown> = {
      language: patch.language,
      timezone: patch.timezone,
      notify_email: patch.notifyEmail,
      notify_sms: patch.notifySms,
      notify_push: patch.notifyPush,
      extra: patch.extra !== undefined ? JSON.stringify(patch.extra) : undefined,
    };

    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = $${i}`);
        values.push(value);
        i += 1;
      }
    }

    if (fields.length === 0) {
      const existing = await this.findByUserId(userId);
      if (!existing) throw new Error(`Preferences for user ${userId} not found`);
      return existing;
    }

    values.push(userId);
    const result = await this.pool.query<UserPreferenceRow>(
      `UPDATE user_preferences SET ${fields.join(", ")} WHERE user_id = $${i} RETURNING *`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error(`Preferences for user ${userId} not found`);
    }

    return toEntity(result.rows[0]);
  }
}
