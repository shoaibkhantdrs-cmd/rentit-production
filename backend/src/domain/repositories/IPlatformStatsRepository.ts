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
  /** COUNT(DISTINCT owner_id) of currently-published properties whose
   * owner has completed identity verification
   * (users.identity_verified_at IS NOT NULL -- the same "verified"
   * signal ApproveIdentityVerification.usecase.ts already sets).
   * Deliberately keyed off properties.owner_id, NOT the "property_owner"
   * RBAC role: that role is a manually-granted permission flag (see
   * UpdateUserRolesUseCase) that an admin/super_admin account creating a
   * listing has no reason to ever hold, so counting by role undercounts
   * real owners. This counts who actually owns a real, live listing. */
  verifiedOwners: number;
}

export interface IPlatformStatsRepository {
  getStats(): Promise<PlatformStats>;
}
