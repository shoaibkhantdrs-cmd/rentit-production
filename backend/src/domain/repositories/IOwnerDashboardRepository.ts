/**
 * Phase 3 Part 3 (Owner Dashboard, must-have slice). A dedicated read-model
 * port for a single owner's cross-listing totals, mirroring why
 * IPlatformStatsRepository and IAdminAnalyticsRepository are kept separate
 * from the per-entity repositories (IPropertyRepository, ...): this reads
 * across properties and conversations, which doesn't belong to either
 * entity's own repository. Unlike IAdminAnalyticsRepository (platform-wide,
 * admin-only), every number here must be scoped to exactly one owner --
 * see OwnerDashboardRepository.ts for the query-level scoping and
 * PropertyController.myStats for why ownerId can only ever come from the
 * authenticated JWT (req.user.sub), never a caller-supplied value.
 */
export interface OwnerDashboardStats {
  /** COUNT(*) of this owner's non-deleted properties, any status (draft,
   * pending_review, published, rented, inactive, removed) -- matches
   * exactly what PropertyRepository.findByOwner (GET /properties/mine)
   * already lists, so this number never disagrees with the owner's own
   * listing page. */
  totalListings: number;
  /** SUM(view_count) across those same properties. */
  totalViews: number;
  /** SUM(favorite_count) across those same properties. */
  totalFavorites: number;
  /** COUNT(*) of distinct conversations scoped to one of this owner's
   * properties (property_id IS NOT NULL and that property belongs to this
   * owner) -- one conversation is treated as one enquiry regardless of how
   * many messages it contains. General, non-property-scoped conversations
   * and conversations about another owner's property are excluded. */
  totalEnquiries: number;
}

export interface IOwnerDashboardRepository {
  getStats(ownerId: string): Promise<OwnerDashboardStats>;
}
