"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryAdminAnalyticsRepository = void 0;
function dayKey(date) {
    return date.toISOString().slice(0, 10);
}
/** In-memory stand-in for AdminAnalyticsRepository. Reads across the other
 * fakes' public state (Maps/arrays) the same way the real repo reads across
 * Postgres tables -- no separate storage of its own. */
class InMemoryAdminAnalyticsRepository {
    userRepo;
    propertyRepo;
    propertyReportRepo;
    userReportRepo;
    identityVerificationRepo;
    propertyViewRepo;
    propertyFavoriteRepo;
    constructor(userRepo, propertyRepo, propertyReportRepo, userReportRepo, identityVerificationRepo, propertyViewRepo, propertyFavoriteRepo) {
        this.userRepo = userRepo;
        this.propertyRepo = propertyRepo;
        this.propertyReportRepo = propertyReportRepo;
        this.userReportRepo = userReportRepo;
        this.identityVerificationRepo = identityVerificationRepo;
        this.propertyViewRepo = propertyViewRepo;
        this.propertyFavoriteRepo = propertyFavoriteRepo;
    }
    async getDashboardStats() {
        const users = Array.from(this.userRepo.users.values()).filter((u) => !u.deletedAt);
        const properties = Array.from(this.propertyRepo.properties.values()).filter((p) => !p.deletedAt);
        return {
            totalUsers: users.length,
            activeUsers: users.filter((u) => u.status === "active").length,
            suspendedUsers: users.filter((u) => u.status === "suspended").length,
            bannedUsers: users.filter((u) => u.status === "banned").length,
            totalProperties: properties.length,
            publishedProperties: properties.filter((p) => p.status === "published").length,
            pendingProperties: properties.filter((p) => p.status === "pending_review").length,
            rejectedProperties: properties.filter((p) => p.status === "rejected").length,
            hiddenProperties: properties.filter((p) => p.status === "inactive").length,
            featuredProperties: properties.filter((p) => p.isFeatured).length,
            totalViews: properties.reduce((sum, p) => sum + p.viewCount, 0),
            totalFavorites: properties.reduce((sum, p) => sum + p.favoriteCount, 0),
            pendingPropertyReports: this.propertyReportRepo.reports.filter((r) => r.status === "pending").length,
            pendingUserReports: this.userReportRepo.reports.filter((r) => r.status === "pending").length,
            pendingVerifications: this.identityVerificationRepo.verifications.filter((v) => v.status === "pending")
                .length,
        };
    }
    async getGrowth(metric, days) {
        const timestamps = (() => {
            switch (metric) {
                case "users":
                    return Array.from(this.userRepo.users.values()).map((u) => u.createdAt);
                case "properties":
                    return Array.from(this.propertyRepo.properties.values())
                        .filter((p) => !p.deletedAt)
                        .map((p) => p.createdAt);
                case "views":
                    return this.propertyViewRepo.views.map((v) => v.viewedAt);
                case "favorites":
                    return Array.from(this.propertyFavoriteRepo.favorites.values()).map((f) => f.createdAt);
                case "reports":
                    return [
                        ...this.propertyReportRepo.reports.map((r) => r.createdAt),
                        ...this.userReportRepo.reports.map((r) => r.createdAt),
                    ];
                default:
                    return [];
            }
        })();
        const counts = new Map();
        for (const ts of timestamps) {
            const key = dayKey(ts);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const points = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i -= 1) {
            const d = new Date(today.getTime() - i * 86_400_000);
            const key = dayKey(d);
            points.push({ date: key, count: counts.get(key) ?? 0 });
        }
        return points;
    }
    async getMostViewedProperties(limit) {
        return Array.from(this.propertyRepo.properties.values())
            .filter((p) => !p.deletedAt)
            .sort((a, b) => b.viewCount - a.viewCount || b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit)
            .map((p) => ({
            propertyId: p.id,
            title: p.title,
            ownerId: p.ownerId,
            viewCount: p.viewCount,
            favoriteCount: p.favoriteCount,
        }));
    }
    async getMostFavoritedProperties(limit) {
        return Array.from(this.propertyRepo.properties.values())
            .filter((p) => !p.deletedAt)
            .sort((a, b) => b.favoriteCount - a.favoriteCount || b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit)
            .map((p) => ({
            propertyId: p.id,
            title: p.title,
            ownerId: p.ownerId,
            viewCount: p.viewCount,
            favoriteCount: p.favoriteCount,
        }));
    }
}
exports.InMemoryAdminAnalyticsRepository = InMemoryAdminAnalyticsRepository;
