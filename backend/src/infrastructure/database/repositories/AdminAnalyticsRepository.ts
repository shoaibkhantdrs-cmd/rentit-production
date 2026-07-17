import { Pool } from "pg";
import {
  AdminDashboardStats,
  GrowthMetric,
  GrowthPoint,
  IAdminAnalyticsRepository,
  PropertyAnalyticsRow,
} from "@/domain/repositories/IAdminAnalyticsRepository";

interface PropertyAnalyticsRowDb {
  property_id: string;
  title: string;
  owner_id: string;
  view_count: number;
  favorite_count: number;
}

function toPropertyAnalyticsRow(row: PropertyAnalyticsRowDb): PropertyAnalyticsRow {
  return {
    propertyId: row.property_id,
    title: row.title,
    ownerId: row.owner_id,
    viewCount: row.view_count,
    favoriteCount: row.favorite_count,
  };
}

/** Per-metric SQL fragment producing `(ts_column, source_table, extra_where)`
 * used to build the zero-filled daily growth series below. `extraWhere` is
 * an additional condition (no leading "WHERE"/"AND") ANDed onto the
 * mandatory date-range bound applied in getGrowth() -- every source is
 * always bounded to the requested window, on top of whatever else it
 * already filtered on. */
const GROWTH_SOURCES: Record<GrowthMetric, { table: string; column: string; extraWhere: string | null }> = {
  users: { table: "users", column: "created_at", extraWhere: null },
  properties: { table: "properties", column: "created_at", extraWhere: "deleted_at IS NULL" },
  views: { table: "property_views", column: "viewed_at", extraWhere: null },
  favorites: { table: "property_favorites", column: "created_at", extraWhere: null },
  reports: {
    table:
      "(SELECT created_at FROM property_reports UNION ALL SELECT created_at FROM user_reports) AS combined_reports",
    column: "created_at",
    extraWhere: null,
  },
};

export class AdminAnalyticsRepository implements IAdminAnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [
      userStatusResult,
      propertyStatusResult,
      featuredResult,
      viewFavoriteTotalsResult,
      pendingPropertyReportsResult,
      pendingUserReportsResult,
      pendingVerificationsResult,
    ] = await Promise.all([
      this.pool.query<{ status: string; count: string }>(
        "SELECT status, COUNT(*) FROM users WHERE deleted_at IS NULL GROUP BY status",
      ),
      this.pool.query<{ status: string; count: string }>(
        "SELECT status, COUNT(*) FROM properties WHERE deleted_at IS NULL GROUP BY status",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM properties WHERE is_featured = true AND deleted_at IS NULL",
      ),
      this.pool.query<{ total_views: string; total_favorites: string }>(
        "SELECT COALESCE(SUM(view_count), 0) AS total_views, COALESCE(SUM(favorite_count), 0) AS total_favorites FROM properties WHERE deleted_at IS NULL",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM property_reports WHERE status = 'pending'",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM user_reports WHERE status = 'pending'",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM identity_verifications WHERE status = 'pending'",
      ),
    ]);

    const userCounts = new Map(userStatusResult.rows.map((r) => [r.status, parseInt(r.count, 10)]));
    const propertyCounts = new Map(
      propertyStatusResult.rows.map((r) => [r.status, parseInt(r.count, 10)]),
    );

    const totalUsers = [...userCounts.values()].reduce((sum, c) => sum + c, 0);
    const totalProperties = [...propertyCounts.values()].reduce((sum, c) => sum + c, 0);

    return {
      totalUsers,
      activeUsers: userCounts.get("active") ?? 0,
      suspendedUsers: userCounts.get("suspended") ?? 0,
      bannedUsers: userCounts.get("banned") ?? 0,
      totalProperties,
      publishedProperties: propertyCounts.get("published") ?? 0,
      pendingProperties: propertyCounts.get("pending_review") ?? 0,
      rejectedProperties: propertyCounts.get("rejected") ?? 0,
      hiddenProperties: propertyCounts.get("inactive") ?? 0,
      featuredProperties: parseInt(featuredResult.rows[0].count, 10),
      totalViews: parseInt(viewFavoriteTotalsResult.rows[0].total_views, 10),
      totalFavorites: parseInt(viewFavoriteTotalsResult.rows[0].total_favorites, 10),
      pendingPropertyReports: parseInt(pendingPropertyReportsResult.rows[0].count, 10),
      pendingUserReports: parseInt(pendingUserReportsResult.rows[0].count, 10),
      pendingVerifications: parseInt(pendingVerificationsResult.rows[0].count, 10),
    };
  }

  async getGrowth(metric: GrowthMetric, days: number): Promise<GrowthPoint[]> {
    const source = GROWTH_SOURCES[metric];
    // Perf fix: the inner aggregate used to have no date bound at all, so it
    // grouped every row this append-only table has ever had on every call,
    // then threw away everything outside the requested window only after
    // the full scan finished. Bounding the inner query to the exact same
    // window the outer generate_series produces means it only ever touches
    // rows that can possibly show up in the response.
    // Regression fix (RC1 QA): the lower bound is now cast `::date` to
    // floor it to that day's midnight, matching generate_series's own
    // lower bound below (also `::date`). Before this cast, the filter used
    // an exact "N days ago, same time-of-day" timestamp while
    // generate_series started at that day's midnight -- any row created
    // between midnight and "now's time-of-day" on the oldest requested day
    // was excluded by this WHERE clause even though generate_series still
    // produced a bucket expecting a full day's count, silently
    // undercounting the first data point of every growth chart.
    const dateFilter = `${source.column} >= (now() - ($1::int - 1) * interval '1 day')::date AND ${source.column} <= now()`;
    const where = source.extraWhere ? `WHERE ${dateFilter} AND ${source.extraWhere}` : `WHERE ${dateFilter}`;
    const result = await this.pool.query<{ day: string; count: string }>(
      `SELECT gs::date::text AS day, COALESCE(counted.count, 0) AS count
       FROM generate_series(
         (now() - ($1::int - 1) * interval '1 day')::date,
         now()::date,
         interval '1 day'
       ) AS gs
       LEFT JOIN (
         SELECT date_trunc('day', ${source.column})::date AS day, COUNT(*) AS count
         FROM ${source.table}
         ${where}
         GROUP BY 1
       ) AS counted ON counted.day = gs::date
       ORDER BY gs`,
      [days],
    );
    return result.rows.map((row) => ({ date: row.day, count: parseInt(row.count, 10) }));
  }

  async getMostViewedProperties(limit: number): Promise<PropertyAnalyticsRow[]> {
    const result = await this.pool.query<PropertyAnalyticsRowDb>(
      `SELECT id AS property_id, title, owner_id, view_count, favorite_count
       FROM properties
       WHERE deleted_at IS NULL
       ORDER BY view_count DESC, created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(toPropertyAnalyticsRow);
  }

  async getMostFavoritedProperties(limit: number): Promise<PropertyAnalyticsRow[]> {
    const result = await this.pool.query<PropertyAnalyticsRowDb>(
      `SELECT id AS property_id, title, owner_id, view_count, favorite_count
       FROM properties
       WHERE deleted_at IS NULL
       ORDER BY favorite_count DESC, created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(toPropertyAnalyticsRow);
  }
}
