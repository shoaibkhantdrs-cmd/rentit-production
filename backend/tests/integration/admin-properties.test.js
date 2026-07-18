"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildAdminTestContainer_1 = require("../support/buildAdminTestContainer");
const AppError_1 = require("@/domain/errors/AppError");
async function seedProperty(container, overrides = {}) {
    const owner = await container.repos.userRepo.create({
        name: "Owner",
        email: `owner-${Date.now()}-${Math.random()}@example.com`,
    });
    // The in-memory fake doesn't enforce a category FK, so any UUID-shaped
    // string is fine here -- these tests don't exercise category filtering.
    const created = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: "00000000-0000-0000-0000-000000000001",
        title: "Test Listing",
        description: "A place to live",
        propertyType: "apartment",
        rentAmount: 20000,
        securityDeposit: 40000,
        areaSqft: 800,
        bedrooms: 2,
        bathrooms: 1,
        parkingSpaces: 1,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    if (Object.keys(overrides).length > 0) {
        return container.repos.propertyRepo.update(created.id, overrides);
    }
    return created;
}
(0, node_test_1.test)("ApprovePropertyUseCase: publishes a pending property, records history, notifies owner", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });
    const property = await seedProperty(container, { status: "pending_review" });
    const updated = await container.approveProperty.execute({ propertyId: property.id, actorId: admin.id });
    strict_1.default.equal(updated.status, "published");
    strict_1.default.equal(updated.moderatedBy, admin.id);
    const history = container.repos.propertyStatusHistoryRepo.entries;
    strict_1.default.equal(history[history.length - 1].newStatus, "published");
    const notifications = [...container.repos.notificationRepo.notifications.values()].filter((n) => n.userId === property.ownerId);
    strict_1.default.equal(notifications.length, 1);
    strict_1.default.equal(notifications[0].type, "property.approved");
    await strict_1.default.rejects(() => container.approveProperty.execute({ propertyId: property.id, actorId: admin.id }), AppError_1.ValidationError, "approving an already-published property should fail");
});
(0, node_test_1.test)("RejectPropertyUseCase: requires a reason, sets rejection_reason and status", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin2@example.com" });
    const property = await seedProperty(container, { status: "pending_review" });
    await strict_1.default.rejects(() => container.rejectProperty.execute({ propertyId: property.id, actorId: admin.id, reason: "  " }), AppError_1.ValidationError);
    const updated = await container.rejectProperty.execute({
        propertyId: property.id,
        actorId: admin.id,
        reason: "Fake listing photos",
    });
    strict_1.default.equal(updated.status, "rejected");
    strict_1.default.equal(updated.rejectionReason, "Fake listing photos");
});
(0, node_test_1.test)("HideProperty/UnhideProperty: hides a published listing then restores it", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin3@example.com" });
    const property = await seedProperty(container, { status: "published" });
    const hidden = await container.hideProperty.execute({ propertyId: property.id, actorId: admin.id });
    strict_1.default.equal(hidden.status, "inactive");
    await strict_1.default.rejects(() => container.unhideProperty.execute({ propertyId: "00000000-0000-0000-0000-000000000000", actorId: admin.id }), AppError_1.NotFoundError);
    const restored = await container.unhideProperty.execute({ propertyId: property.id, actorId: admin.id });
    strict_1.default.equal(restored.status, "published");
});
(0, node_test_1.test)("Feature/UnfeatureProperty: only published listings can be featured", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin4@example.com" });
    const draft = await seedProperty(container, { status: "draft" });
    await strict_1.default.rejects(() => container.featureProperty.execute({ propertyId: draft.id, actorId: admin.id }), AppError_1.ValidationError);
    const published = await seedProperty(container, { status: "published" });
    const featured = await container.featureProperty.execute({ propertyId: published.id, actorId: admin.id });
    strict_1.default.equal(featured.isFeatured, true);
    const unfeatured = await container.unfeatureProperty.execute({ propertyId: published.id, actorId: admin.id });
    strict_1.default.equal(unfeatured.isFeatured, false);
});
(0, node_test_1.test)("AdminSearchPropertiesUseCase: filters by status and isFeatured, sorts most_favorited", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const pending = await seedProperty(container, { status: "pending_review" });
    const publishedLowFav = await seedProperty(container, { status: "published", favoriteCount: 1 });
    const publishedHighFav = await seedProperty(container, { status: "published", favoriteCount: 5 });
    const pendingResults = await container.adminSearchProperties.execute({
        status: "pending_review",
        sort: "newest",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(pendingResults.total, 1);
    strict_1.default.equal(pendingResults.items[0].id, pending.id);
    const byFavorites = await container.adminSearchProperties.execute({
        status: "published",
        sort: "most_favorited",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(byFavorites.items[0].id, publishedHighFav.id);
    strict_1.default.equal(byFavorites.items[1].id, publishedLowFav.id);
});
(0, node_test_1.test)("BulkModeratePropertiesUseCase: applies action to many properties, tolerates partial failure", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin5@example.com" });
    const p1 = await seedProperty(container, { status: "pending_review" });
    const p2 = await seedProperty(container, { status: "pending_review" });
    const missingId = "00000000-0000-0000-0000-000000000099";
    const result = await container.bulkModerateProperties.execute({
        propertyIds: [p1.id, p2.id, missingId],
        action: "approve",
        actorId: admin.id,
        actorRoles: ["admin"],
    });
    strict_1.default.equal(result.results.filter((r) => r.success).length, 2);
    const failed = result.results.find((r) => !r.success);
    strict_1.default.ok(failed);
    strict_1.default.equal(failed?.propertyId, missingId);
    await strict_1.default.rejects(() => container.bulkModerateProperties.execute({
        propertyIds: [],
        action: "approve",
        actorId: admin.id,
        actorRoles: ["admin"],
    }), AppError_1.ValidationError, "empty propertyIds should be rejected");
    await strict_1.default.rejects(() => container.bulkModerateProperties.execute({
        propertyIds: [p1.id],
        action: "reject",
        actorId: admin.id,
        actorRoles: ["admin"],
    }), AppError_1.ValidationError, "bulk reject without a reason should be rejected");
});
(0, node_test_1.test)("GetPropertyModerationHistoryUseCase: per-property and admin-wide feeds", async () => {
    const container = (0, buildAdminTestContainer_1.buildAdminTestContainer)();
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin6@example.com" });
    const property = await seedProperty(container, { status: "pending_review" });
    await container.approveProperty.execute({ propertyId: property.id, actorId: admin.id });
    const perProperty = await container.getPropertyModerationHistory.execute({
        propertyId: property.id,
        page: 1,
        pageSize: 10,
    });
    strict_1.default.ok(perProperty.total >= 1);
    const recent = await container.getPropertyModerationHistory.execute({ page: 1, pageSize: 10 });
    strict_1.default.ok(recent.total >= perProperty.total);
});
