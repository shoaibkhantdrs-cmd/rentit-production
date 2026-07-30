import { Pool } from "pg";
import { IPlatformStatsRepository, PlatformStats } from "@/domain/repositories/IPlatformStatsRepository";

/**
 * Backs the public homepage "Platform Statistics" section (see
 * IPlatformStatsRepository for why this is its own port rather than
 * bolted onto PropertyRepository/UserRepository). Every query here is
 * read-only, aggregate-only, and safe to expose on an unauthenticated
 * route -- no row-level data ever leaves this class.
 */
export class PlatformStatsRepository implements IPlatformStatsRepository {
  constructor(private readonly pool: Pool) {}

  async getStats(): Promise<PlatformStats> {
    const [activeListingsResult, categoriesResult, citiesResult, verifiedOwnersResult] = await Promise.all([
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM properties WHERE status = 'published' AND deleted_at IS NULL",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM property_categories WHERE deleted_at IS NULL",
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT pl.city) AS count
         FROM properties p
         JOIN property_locations pl ON pl.property_id = p.id
         WHERE p.status = 'published' AND p.deleted_at IS NULL AND pl.city IS NOT NULL`,
      ),
      // "Verified owner" = has the property_owner role AND has completed
      // identity verification. Uses users.identity_verified_at (the same
      // flag ApproveIdentityVerification.usecase.ts sets) rather than
      // joining identity_verifications directly, since a user can
      // resubmit after a rejection -- identity_verified_at is this app's
      // single source of truth for "currently verified", immune to that
      // resubmission edge case.
      this.pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT u.id) AS count
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
         WHERE r.name = 'property_owner'
           AND u.identity_verified_at IS NOT NULL
           AND u.deleted_at IS NULL`,
      ),
    ]);

    return {
      activeListings: parseInt(activeListingsResult.rows[0].count, 10),
      totalCategories: parseInt(categoriesResult.rows[0].count, 10),
      citiesCovered: parseInt(citiesResult.rows[0].count, 10),
      verifiedOwners: parseInt(verifiedOwnersResult.rows[0].count, 10),
    };
  }
}
