"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildAdminTestContainer_1 = require("../support/buildAdminTestContainer");
const AppError_1 = require("@/domain/errors/AppError");
(0, node_test_1.test)("BroadcastNotificationUseCase: creates one notification per active recipient and pushes via the push service", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });
    const active1 = await container.repos.userRepo.create({ name: "Active1", email: "a1@example.com" });
    const active2 = await container.repos.userRepo.create({ name: "Active2", email: "a2@example.com" });
    const suspended = await container.repos.userRepo.create({ name: "Suspended", email: "s1@example.com" });
    await container.repos.userRepo.update(suspended.id, { status: "suspended" });
    const result = await container.broadcastNotification.execute({
        title: "Scheduled maintenance",
        body: "RentIt will be briefly unavailable tonight.",
        audience: {},
        actorId: admin.id,
    });
    // Audience {} defaults to status "active" with no role filter, so it
    // reaches every active user including the admin who triggered it --
    // that's 3 here: admin, active1, active2 (suspended is excluded).
    strict_1.default.equal(result.recipientCount, 3);
    const notifiedUserIds = [...container.repos.notificationRepo.notifications.values()].map((n) => n.userId);
    strict_1.default.ok(notifiedUserIds.includes(active1.id));
    strict_1.default.ok(notifiedUserIds.includes(active2.id));
    strict_1.default.ok(!notifiedUserIds.includes(suspended.id));
    strict_1.default.equal(container.pushService.sent.length, 3);
    await strict_1.default.rejects(() => container.broadcastNotification.execute({
        title: "",
        body: "x",
        audience: {},
        actorId: admin.id,
    }), AppError_1.ValidationError);
});
(0, node_test_1.test)("BroadcastNotificationUseCase: scopes to a role when specified", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin2@example.com" });
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
    const ownerRole = await container.repos.roleRepo.findByName("property_owner");
    if (!ownerRole)
        throw new Error("property_owner role missing from seed");
    await container.repos.userRoleRepo.assign(owner.id, ownerRole.id, null);
    await container.repos.userRepo.create({ name: "Plain Customer", email: "customer@example.com" });
    const result = await container.broadcastNotification.execute({
        title: "New owner feature",
        body: "Check out bulk listing tools.",
        audience: { role: "property_owner" },
        actorId: admin.id,
    });
    strict_1.default.equal(result.recipientCount, 1);
});
(0, node_test_1.test)("GetDashboardStatsUseCase: aggregates counts across users, properties, reports, verifications", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner3@example.com" });
    await container.repos.userRepo.create({ name: "Customer", email: "cust@example.com" });
    const property = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: "00000000-0000-0000-0000-000000000001",
        title: "Listing",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 10000,
        securityDeposit: 20000,
        areaSqft: 500,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    await container.repos.propertyRepo.update(property.id, { status: "published" });
    const stats = await container.getDashboardStats.execute();
    strict_1.default.equal(stats.totalUsers, 2);
    strict_1.default.equal(stats.totalProperties, 1);
    strict_1.default.equal(stats.publishedProperties, 1);
    strict_1.default.equal(stats.pendingPropertyReports, 0);
});
(0, node_test_1.test)("GetGrowthAnalyticsUseCase: validates days range and zero-fills days with no activity", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    await container.repos.userRepo.create({ name: "New User", email: "newuser@example.com" });
    await strict_1.default.rejects(() => container.getGrowthAnalytics.execute({ metric: "users", days: 0 }), AppError_1.ValidationError);
    await strict_1.default.rejects(() => container.getGrowthAnalytics.execute({ metric: "users", days: 400 }), AppError_1.ValidationError);
    const result = await container.getGrowthAnalytics.execute({ metric: "users", days: 7 });
    strict_1.default.equal(result.points.length, 7);
    const total = result.points.reduce((sum, p) => sum + p.count, 0);
    strict_1.default.ok(total >= 1);
});
(0, node_test_1.test)("GetTopPropertiesUseCase: validates limit and sorts by the requested metric", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner4@example.com" });
    const low = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: "00000000-0000-0000-0000-000000000001",
        title: "Low views",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 10000,
        securityDeposit: 20000,
        areaSqft: 500,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    const high = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: "00000000-0000-0000-0000-000000000001",
        title: "High views",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 10000,
        securityDeposit: 20000,
        areaSqft: 500,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    await container.repos.propertyRepo.update(low.id, { viewCount: 2 });
    await container.repos.propertyRepo.update(high.id, { viewCount: 10 });
    await strict_1.default.rejects(() => container.getTopProperties.execute({ metric: "most_viewed", limit: 0 }), AppError_1.ValidationError);
    const result = await container.getTopProperties.execute({ metric: "most_viewed", limit: 5 });
    strict_1.default.equal(result.items[0].propertyId, high.id);
    strict_1.default.equal(result.items[1].propertyId, low.id);
});
(0, node_test_1.test)("SearchAuditLogsUseCase: filters by action and paginates", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin5@example.com" });
    await container.repos.auditLogRepo.record({ userId: admin.id, action: "admin.user.deleted" });
    await container.repos.auditLogRepo.record({ userId: admin.id, action: "admin.property.approved" });
    const result = await container.searchAuditLogs.execute({
        action: "admin.property.approved",
        page: 1,
        pageSize: 10,
    });
    strict_1.default.equal(result.total, 1);
    strict_1.default.equal(result.items[0].action, "admin.property.approved");
});
(0, node_test_1.test)("GetSystemHealthUseCase: reports ok when the database is healthy, degraded when not", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const healthy = await container.getSystemHealth.execute();
    strict_1.default.equal(healthy.status, "ok");
    strict_1.default.equal(healthy.database, "ok");
    strict_1.default.equal(typeof healthy.uptimeSeconds, "number");
    container.healthCheckService.healthy = false;
    const degraded = await container.getSystemHealth.execute();
    strict_1.default.equal(degraded.status, "degraded");
    strict_1.default.equal(degraded.database, "error");
});
