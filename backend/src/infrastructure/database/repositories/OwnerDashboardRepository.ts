import { Pool } from "pg";
import { IOwnerDashboardRepository, OwnerDashboardStats } from "@/domain/repositories/IOwnerDashboardRepository";

/**
 * Backs GET /properties/mine/stats (Phase 3 Part 3, must-have slice). Every
 * query here is filtered by owner_id, taken by the use case exclusively
 * from the authenticated caller's own id -- see IOwnerDashboardRepository
 * for why this is its own port rather than bolted onto PropertyRepository,
 * and PropertyController.myStats for the authorization boundary.
 */
export class OwnerDashboardRepository implements IOwnerDashboardRepository {
  constructor(private readonly pool: Pool) {}

  async getStats(ownerId: string): Promise<OwnerDashboardStats> {
    const [totalsResult, enquiriesResult] = await Promise.all([
      // Same filter as PropertyRepository.findByOwner (owner_id + not
      // soft-deleted, no status filter) so this total never disagrees with
      // what GET /properties/mine actually lists for this owner.
      this.pool.query<{ total_listings: string; total_views: string; total_favorites: string }>(
        `SELECT
           COUNT(*) AS total_listings,
           COALESCE(SUM(view_count), 0) AS total_views,
           COALESCE(SUM(favorite_count), 0) AS total_favorites
         FROM properties
         WHERE owner_id = $1
           AND deleted_at IS NULL`,
        [ownerId],
      ),
      // One conversation = one enquiry (see IOwnerDashboardRepository doc).
      // The INNER JOIN on properties naturally excludes conversations with
      // a NULL property_id (general, non-property chats) since NULL never
      // matches p.id, and p.owner_id = $1 excludes every other owner's
      // properties. p.deleted_at IS NULL matches the same soft-delete
      // filter as the totals query above; c.deleted_at IS NULL excludes
      // conversations that were themselves soft-deleted.
      this.pool.query<{ total_enquiries: string }>(
        `SELECT COUNT(*) AS total_enquiries
         FROM conversations c
         JOIN properties p ON p.id = c.property_id
         WHERE p.owner_id = $1
           AND p.deleted_at IS NULL
           AND c.deleted_at IS NULL`,
        [ownerId],
      ),
    ]);

    return {
      totalListings: parseInt(totalsResult.rows[0].total_listings, 10),
      totalViews: parseInt(totalsResult.rows[0].total_views, 10),
      totalFavorites: parseInt(totalsResult.rows[0].total_favorites, 10),
      totalEnquiries: parseInt(enquiriesResult.rows[0].total_enquiries, 10),
    };
  }
}
