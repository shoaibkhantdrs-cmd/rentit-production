import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdminTestContainer } from "../support/buildAdminTestContainer";
import { ValidationError } from "@/domain/errors/AppError";

test("BroadcastNotificationUseCase: creates one notification per active recipient and pushes via the push service", async () => {
  const container = buildAdminTestContainer();
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
  assert.equal(result.recipientCount, 3);
  const notifiedUserIds = [...container.repos.notificationRepo.notifications.values()].map((n) => n.userId);
  assert.ok(notifiedUserIds.includes(active1.id));
  assert.ok(notifiedUserIds.includes(active2.id));
  assert.ok(!notifiedUserIds.includes(suspended.id));
  assert.equal(container.pushService.sent.length, 3);

  await assert.rejects(
    () =>
      container.broadcastNotification.execute({
        title: "",
        body: "x",
        audience: {},
        actorId: admin.id,
      }),
    ValidationError,
  );
});

test("BroadcastNotificationUseCase: scopes to a role when specified", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin2@example.com" });
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
  const ownerRole = await container.repos.roleRepo.findByName("property_owner");
  if (!ownerRole) throw new Error("property_owner role missing from seed");
  await container.repos.userRoleRepo.assign(owner.id, ownerRole.id, null);
  await container.repos.userRepo.create({ name: "Plain Customer", email: "customer@example.com" });

  const result = await container.broadcastNotification.execute({
    title: "New owner feature",
    body: "Check out bulk listing tools.",
    audience: { role: "property_owner" },
    actorId: admin.id,
  });

  assert.equal(result.recipientCount, 1);
});

test("GetDashboardStatsUseCase: aggregates counts across users, properties, reports, verifications", async () => {
  const container = buildAdminTestContainer();
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
  assert.equal(stats.totalUsers, 2);
  assert.equal(stats.totalProperties, 1);
  assert.equal(stats.publishedProperties, 1);
  assert.equal(stats.pendingPropertyReports, 0);
});

test("GetGrowthAnalyticsUseCase: validates days range and zero-fills days with no activity", async () => {
  const container = buildAdminTestContainer();
  await container.repos.userRepo.create({ name: "New User", email: "newuser@example.com" });

  await assert.rejects(() => container.getGrowthAnalytics.execute({ metric: "users", days: 0 }), ValidationError);
  await assert.rejects(
    () => container.getGrowthAnalytics.execute({ metric: "users", days: 400 }),
    ValidationError,
  );

  const result = await container.getGrowthAnalytics.execute({ metric: "users", days: 7 });
  assert.equal(result.points.length, 7);
  const total = result.points.reduce((sum, p) => sum + p.count, 0);
  assert.ok(total >= 1);
});

test("GetTopPropertiesUseCase: validates limit and sorts by the requested metric", async () => {
  const container = buildAdminTestContainer();
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

  await assert.rejects(
    () => container.getTopProperties.execute({ metric: "most_viewed", limit: 0 }),
    ValidationError,
  );

  const result = await container.getTopProperties.execute({ metric: "most_viewed", limit: 5 });
  assert.equal(result.items[0].propertyId, high.id);
  assert.equal(result.items[1].propertyId, low.id);
});

test("SearchAuditLogsUseCase: filters by action and paginates", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin5@example.com" });
  await container.repos.auditLogRepo.record({ userId: admin.id, action: "admin.user.deleted" });
  await container.repos.auditLogRepo.record({ userId: admin.id, action: "admin.property.approved" });

  const result = await container.searchAuditLogs.execute({
    action: "admin.property.approved",
    page: 1,
    pageSize: 10,
  });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].action, "admin.property.approved");
});

test("GetSystemHealthUseCase: reports ok when the database is healthy, degraded when not", async () => {
  const container = buildAdminTestContainer();

  const healthy = await container.getSystemHealth.execute();
  assert.equal(healthy.status, "ok");
  assert.equal(healthy.database, "ok");
  assert.equal(typeof healthy.uptimeSeconds, "number");

  container.healthCheckService.healthy = false;
  const degraded = await container.getSystemHealth.execute();
  assert.equal(degraded.status, "degraded");
  assert.equal(degraded.database, "error");
});
