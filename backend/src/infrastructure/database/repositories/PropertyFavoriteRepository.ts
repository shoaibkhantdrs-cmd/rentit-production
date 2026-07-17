import { Pool } from "pg";
import { IPropertyFavoriteRepository } from "@/domain/repositories/IPropertyFavoriteRepository";

export class PropertyFavoriteRepository implements IPropertyFavoriteRepository {
  constructor(private readonly pool: Pool) {}

  async add(propertyId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO property_favorites (property_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (property_id, user_id) DO NOTHING`,
      [propertyId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async remove(propertyId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM property_favorites WHERE property_id = $1 AND user_id = $2",
      [propertyId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async exists(propertyId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM property_favorites WHERE property_id = $1 AND user_id = $2) AS exists",
      [propertyId, userId],
    );
    return result.rows[0].exists;
  }

  async listFavoritedPropertyIds(userId: string, propertyIds: string[]): Promise<string[]> {
    if (propertyIds.length === 0) return [];
    const result = await this.pool.query<{ property_id: string }>(
      "SELECT property_id FROM property_favorites WHERE user_id = $1 AND property_id = ANY($2::uuid[])",
      [userId, propertyIds],
    );
    return result.rows.map((r) => r.property_id);
  }

  async listPropertyIdsForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ ids: string[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [idsResult, countResult] = await Promise.all([
      this.pool.query<{ property_id: string }>(
        `SELECT property_id FROM property_favorites WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM property_favorites WHERE user_id = $1",
        [userId],
      ),
    ]);

    return {
      ids: idsResult.rows.map((r) => r.property_id),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}
