import { Pool } from "pg";
import {
  IListingBoostRepository,
  NewListingBoostInput,
} from "@/domain/repositories/IListingBoostRepository";
import { BoostType, ListingBoost, ListingBoostStatus } from "@/domain/entities/ListingBoost";

interface ListingBoostRow {
  id: string;
  property_id: string;
  user_id: string;
  boost_type: BoostType;
  status: ListingBoostStatus;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: ListingBoostRow): ListingBoost {
  return {
    id: row.id,
    propertyId: row.property_id,
    userId: row.user_id,
    boostType: row.boost_type,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ListingBoostRepository implements IListingBoostRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewListingBoostInput): Promise<ListingBoost> {
    const result = await this.pool.query<ListingBoostRow>(
      `INSERT INTO listing_boosts (property_id, user_id, boost_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.propertyId, input.userId, input.boostType],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<ListingBoost | null> {
    const result = await this.pool.query<ListingBoostRow>(
      "SELECT * FROM listing_boosts WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async activate(id: string, startsAt: Date, endsAt: Date): Promise<ListingBoost> {
    const result = await this.pool.query<ListingBoostRow>(
      `UPDATE listing_boosts
       SET status = 'active', starts_at = $2, ends_at = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, startsAt, endsAt],
    );
    return toEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: ListingBoostStatus): Promise<ListingBoost> {
    const result = await this.pool.query<ListingBoostRow>(
      "UPDATE listing_boosts SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
      [id, status],
    );
    return toEntity(result.rows[0]);
  }

  async listActivePropertyIds(boostType: BoostType): Promise<string[]> {
    const result = await this.pool.query<{ property_id: string }>(
      `SELECT property_id FROM listing_boosts
       WHERE boost_type = $1 AND status = 'active' AND ends_at > now()`,
      [boostType],
    );
    return result.rows.map((r) => r.property_id);
  }

  async listForUser(userId: string): Promise<ListingBoost[]> {
    const result = await this.pool.query<ListingBoostRow>(
      "SELECT * FROM listing_boosts WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );
    return result.rows.map(toEntity);
  }
}
