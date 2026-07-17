import { Pool } from "pg";
import {
  IUserSubscriptionRepository,
  NewUserSubscriptionInput,
} from "@/domain/repositories/IUserSubscriptionRepository";
import { UserSubscription, UserSubscriptionStatus } from "@/domain/entities/UserSubscription";

interface UserSubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: UserSubscriptionStatus;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: UserSubscriptionRow): UserSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserSubscriptionRepository implements IUserSubscriptionRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewUserSubscriptionInput): Promise<UserSubscription> {
    const result = await this.pool.query<UserSubscriptionRow>(
      `INSERT INTO user_subscriptions (user_id, plan_id) VALUES ($1, $2) RETURNING *`,
      [input.userId, input.planId],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<UserSubscription | null> {
    const result = await this.pool.query<UserSubscriptionRow>(
      "SELECT * FROM user_subscriptions WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async activate(id: string, startsAt: Date, endsAt: Date): Promise<UserSubscription> {
    const result = await this.pool.query<UserSubscriptionRow>(
      `UPDATE user_subscriptions
       SET status = 'active', starts_at = $2, ends_at = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, startsAt, endsAt],
    );
    return toEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: UserSubscriptionStatus): Promise<UserSubscription> {
    const result = await this.pool.query<UserSubscriptionRow>(
      "UPDATE user_subscriptions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, status],
    );
    return toEntity(result.rows[0]);
  }

  async findActiveForUser(userId: string): Promise<UserSubscription | null> {
    const result = await this.pool.query<UserSubscriptionRow>(
      `SELECT * FROM user_subscriptions
       WHERE user_id = $1 AND status = 'active' AND ends_at > now()
       ORDER BY ends_at DESC LIMIT 1`,
      [userId],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async listForUser(userId: string): Promise<UserSubscription[]> {
    const result = await this.pool.query<UserSubscriptionRow>(
      "SELECT * FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map(toEntity);
  }
}
