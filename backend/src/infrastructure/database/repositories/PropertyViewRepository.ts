import { Pool } from "pg";
import {
  IPropertyViewRepository,
  NewPropertyViewInput,
} from "@/domain/repositories/IPropertyViewRepository";
import { PropertyView } from "@/domain/entities/PropertyView";

interface PropertyViewRow {
  id: string;
  property_id: string;
  viewer_user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  viewed_at: Date;
}

function toEntity(row: PropertyViewRow): PropertyView {
  return {
    id: row.id,
    propertyId: row.property_id,
    viewerUserId: row.viewer_user_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    viewedAt: row.viewed_at,
  };
}

export class PropertyViewRepository implements IPropertyViewRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: NewPropertyViewInput): Promise<PropertyView> {
    const result = await this.pool.query<PropertyViewRow>(
      `INSERT INTO property_views (property_id, viewer_user_id, ip_address, user_agent)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [input.propertyId, input.viewerUserId, input.ipAddress, input.userAgent],
    );
    return toEntity(result.rows[0]);
  }

  async hasRecentView(
    propertyId: string,
    viewerKey: string,
    sinceMinutesAgo: number,
  ): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM property_views
         WHERE property_id = $1
           AND (viewer_user_id::text = $2 OR ip_address::text = $2)
           AND viewed_at > now() - ($3 || ' minutes')::interval
       ) AS exists`,
      [propertyId, viewerKey, sinceMinutesAgo],
    );
    return result.rows[0].exists;
  }

  async listRecentPropertyIdsForUser(userId: string, limit: number): Promise<string[]> {
    const result = await this.pool.query<{ property_id: string }>(
      `SELECT property_id FROM (
         SELECT DISTINCT ON (property_id) property_id, viewed_at
         FROM property_views
         WHERE viewer_user_id = $1
         ORDER BY property_id, viewed_at DESC
       ) recent
       ORDER BY viewed_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map((row) => row.property_id);
  }
}
