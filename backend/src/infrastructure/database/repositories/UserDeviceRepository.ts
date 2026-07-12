import { Pool } from "pg";
import {
  IUserDeviceRepository,
  UpsertUserDeviceInput,
} from "@/domain/repositories/IUserDeviceRepository";
import { UserDevice } from "@/domain/entities/UserDevice";

interface UserDeviceRow {
  id: string;
  user_id: string;
  device_id: string;
  platform: UserDevice["platform"];
  user_agent: string | null;
  is_trusted: boolean;
  push_token: string | null;
  first_seen_at: Date;
  last_seen_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: UserDeviceRow): UserDevice {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    platform: row.platform,
    userAgent: row.user_agent,
    isTrusted: row.is_trusted,
    pushToken: row.push_token,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class UserDeviceRepository implements IUserDeviceRepository {
  constructor(private readonly pool: Pool) {}

  async findByUserAndDeviceId(userId: string, deviceId: string): Promise<UserDevice | null> {
    const result = await this.pool.query<UserDeviceRow>(
      `SELECT * FROM user_devices
       WHERE user_id = $1 AND device_id = $2 AND deleted_at IS NULL`,
      [userId, deviceId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async upsert(input: UpsertUserDeviceInput): Promise<UserDevice> {
    const result = await this.pool.query<UserDeviceRow>(
      `INSERT INTO user_devices (user_id, device_id, platform, user_agent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, device_id) WHERE deleted_at IS NULL
       DO UPDATE SET
         last_seen_at = now(),
         user_agent = EXCLUDED.user_agent,
         platform = EXCLUDED.platform
       RETURNING *`,
      [input.userId, input.deviceId, input.platform, input.userAgent],
    );
    return toEntity(result.rows[0]);
  }

  async setPushToken(userId: string, deviceId: string, pushToken: string | null): Promise<UserDevice> {
    const result = await this.pool.query<UserDeviceRow>(
      `UPDATE user_devices
       SET push_token = $3
       WHERE user_id = $1 AND device_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, deviceId, pushToken],
    );
    if (!result.rows[0]) {
      throw new Error(`No device ${deviceId} found for user ${userId} to set a push token on`);
    }
    return toEntity(result.rows[0]);
  }

  async listPushTokensForUsers(
    userIds: string[],
  ): Promise<Array<{ userId: string; pushToken: string }>> {
    if (userIds.length === 0) return [];
    const result = await this.pool.query<{ user_id: string; push_token: string }>(
      `SELECT user_id, push_token FROM user_devices
       WHERE user_id = ANY($1::uuid[]) AND push_token IS NOT NULL AND deleted_at IS NULL`,
      [userIds],
    );
    return result.rows.map((row) => ({ userId: row.user_id, pushToken: row.push_token }));
  }
}
