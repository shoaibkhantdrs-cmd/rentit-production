/**
 * A dedicated read-model port for cross-cutting admin analytics (Phase 4
 * Part 1 Dashboard + Part 7 Analytics), deliberately kept separate from
 * the per-entity repositories (IUserRepository, IPropertyRepository, ...).
 * Bolting "count everything" queries onto every entity's repository
 * interface would bloat each one with admin-only concerns; a single
 * analytics port that reads across tables mirrors how a real admin
 * reporting module is usually built as its own read model.
 */
export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  totalProperties: number;
  publishedProperties: number;
  pendingProperties: number;
  rejectedProperties: number;
  hiddenProperties: number;
  featuredProperties: number;
  totalViews: number;
  totalFavorites: number;
  pendingPropertyReports: number;
  pendingUserReports: number;
  pendingVerifications: number;
}

export interface GrowthPoint {
  date: string; // ISO date (YYYY-MM-DD)
  count: number;
}

export type GrowthMetric = "users" | "properties" | "views" | "favorites" | "reports";

export interface PropertyAnalyticsRow {
  propertyId: string;
  title: string;
  ownerId: string;
  viewCount: number;
  favoriteCount: number;
}

export interface IAdminAnalyticsRepository {
  getDashboardStats(): Promise<AdminDashboardStats>;
  /** Daily counts for the last `days` days, oldest first, zero-filled for days with no activity. */
  getGrowth(metric: GrowthMetric, days: number): Promise<GrowthPoint[]>;
  getMostViewedProperties(limit: number): Promise<PropertyAnalyticsRow[]>;
  getMostFavoritedProperties(limit: number): Promise<PropertyAnalyticsRow[]>;
}
