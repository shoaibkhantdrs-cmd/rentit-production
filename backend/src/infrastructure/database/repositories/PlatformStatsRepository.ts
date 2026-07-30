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
      // Bug fix: this originally joined through user_roles/roles (WHERE
      // r.name = 'property_owner'), on the assumption that every real
      // property owner holds that RBAC role. That assumption is wrong --
      // the "property_owner" role only ever gets granted to a user via a
      // separate, manual "Assign Roles" admin action (see
      // UpdateUserRolesUseCase); it is never auto-assigned on
      // registration or on creating a property. Properties created by an
      // admin/super_admin account are perfectly valid (property.routes.ts
      // authorizes "property_owner", "admin", "super_admin" equally to
      // POST /properties), but that account has no reason to ever hold
      // the property_owner role -- so counting by role silently excluded
      // every real owner who happens to also be staff, and returned 0 in
      // production despite real published listings and a real verified
      // user existing. "Verified owner" should mean "the real, current
      // owner of a real, live listing, whose identity is verified" -- that
      // is determined by properties.owner_id (an actual FK to the actual
      // listing), not by an independent, hand-maintained permission flag
      // that can lag behind or simply never match who really owns a
      // listing. Counting DISTINCT owner_id of published properties fixes
      // this at the source and needs no role table at all. Still uses
      // users.identity_verified_at (the same flag
      // ApproveIdentityVerification.usecase.ts sets) rather than joining
      // identity_verifications directly, since a user can resubmit after
      // a rejection -- identity_verified_at remains this app's single
      // source of truth for "currently verified".
      this.pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT p.owner_id) AS count
         FROM properties p
         JOIN users u ON u.id = p.owner_id
         WHERE p.status = 'published'
           AND p.deleted_at IS NULL
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
