/**
 * A dedicated read-model port for the public homepage "Platform
 * Statistics" section, mirroring how IAdminAnalyticsRepository is kept
 * separate from the per-entity repositories (IPropertyRepository,
 * IUserRepository, ...): this reads across properties/categories/
 * property_locations/users/user_roles, which doesn't belong to any single
 * entity's repository. Unlike IAdminAnalyticsRepository, every number
 * here is served on a PUBLIC, unauthenticated route -- so this port must
 * only ever expose real, already-safe-to-publish aggregate counts, never
 * anything containing PII or admin-only detail.
 */
export interface PlatformStats {
  /** COUNT(*) of properties with status = 'published' (deleted_at IS NULL). */
  activeListings: number;
  /** COUNT(*) of property_categories (deleted_at IS NULL). */
  totalCategories: number;
  /** COUNT(DISTINCT city) among published properties' locations. */
  citiesCovered: number;
  /** COUNT(DISTINCT user) with the property_owner role AND a completed
   * identity verification (users.identity_verified_at IS NOT NULL) --
   * the same "verified" signal ApproveIdentityVerification.usecase.ts
   * already sets, not a separate/duplicated notion of "verified". */
  verifiedOwners: number;
}

export interface IPlatformStatsRepository {
  getStats(): Promise<PlatformStats>;
}
