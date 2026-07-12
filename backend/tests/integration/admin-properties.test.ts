import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdminTestContainer } from "../support/buildAdminTestContainer";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { Property } from "@/domain/entities/Property";

async function seedProperty(
  container: ReturnType<typeof buildAdminTestContainer>,
  overrides: Partial<Property> = {},
): Promise<Property> {
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
    return container.repos.propertyRepo.update(created.id, overrides as never);
  }
  return created;
}

test("ApprovePropertyUseCase: publishes a pending property, records history, notifies owner", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });
  const property = await seedProperty(container, { status: "pending_review" });

  const updated = await container.approveProperty.execute({ propertyId: property.id, actorId: admin.id });
  assert.equal(updated.status, "published");
  assert.equal(updated.moderatedBy, admin.id);

  const history = container.repos.propertyStatusHistoryRepo.entries;
  assert.equal(history[history.length - 1].newStatus, "published");

  const notifications = [...container.repos.notificationRepo.notifications.values()].filter(
    (n) => n.userId === property.ownerId,
  );
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, "property.approved");

  await assert.rejects(
    () => container.approveProperty.execute({ propertyId: property.id, actorId: admin.id }),
    ValidationError,
    "approving an already-published property should fail",
  );
});

test("RejectPropertyUseCase: requires a reason, sets rejection_reason and status", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin2@example.com" });
  const property = await seedProperty(container, { status: "pending_review" });

  await assert.rejects(
    () => container.rejectProperty.execute({ propertyId: property.id, actorId: admin.id, reason: "  " }),
    ValidationError,
  );

  const updated = await container.rejectProperty.execute({
    propertyId: property.id,
    actorId: admin.id,
    reason: "Fake listing photos",
  });
  assert.equal(updated.status, "rejected");
  assert.equal(updated.rejectionReason, "Fake listing photos");
});

test("HideProperty/UnhideProperty: hides a published listing then restores it", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin3@example.com" });
  const property = await seedProperty(container, { status: "published" });

  const hidden = await container.hideProperty.execute({ propertyId: property.id, actorId: admin.id });
  assert.equal(hidden.status, "inactive");

  await assert.rejects(
    () => container.unhideProperty.execute({ propertyId: "00000000-0000-0000-0000-000000000000", actorId: admin.id }),
    NotFoundError,
  );

  const restored = await container.unhideProperty.execute({ propertyId: property.id, actorId: admin.id });
  assert.equal(restored.status, "published");
});

test("Feature/UnfeatureProperty: only published listings can be featured", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin4@example.com" });
  const draft = await seedProperty(container, { status: "draft" });

  await assert.rejects(
    () => container.featureProperty.execute({ propertyId: draft.id, actorId: admin.id }),
    ValidationError,
  );

  const published = await seedProperty(container, { status: "published" });
  const featured = await container.featureProperty.execute({ propertyId: published.id, actorId: admin.id });
  assert.equal(featured.isFeatured, true);

  const unfeatured = await container.unfeatureProperty.execute({ propertyId: published.id, actorId: admin.id });
  assert.equal(unfeatured.isFeatured, false);
});

test("AdminSearchPropertiesUseCase: filters by status and isFeatured, sorts most_favorited", async () => {
  const container = buildAdminTestContainer();
  const pending = await seedProperty(container, { status: "pending_review" });
  const publishedLowFav = await seedProperty(container, { status: "published", favoriteCount: 1 });
  const publishedHighFav = await seedProperty(container, { status: "published", favoriteCount: 5 });

  const pendingResults = await container.adminSearchProperties.execute({
    status: "pending_review",
    sort: "newest",
    page: 1,
    pageSize: 20,
  });
  assert.equal(pendingResults.total, 1);
  assert.equal(pendingResults.items[0].id, pending.id);

  const byFavorites = await container.adminSearchProperties.execute({
    status: "published",
    sort: "most_favorited",
    page: 1,
    pageSize: 20,
  });
  assert.equal(byFavorites.items[0].id, publishedHighFav.id);
  assert.equal(byFavorites.items[1].id, publishedLowFav.id);
});

test("BulkModeratePropertiesUseCase: applies action to many properties, tolerates partial failure", async () => {
  const container = buildAdminTestContainer();
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

  assert.equal(result.results.filter((r) => r.success).length, 2);
  const failed = result.results.find((r) => !r.success);
  assert.ok(failed);
  assert.equal(failed?.propertyId, missingId);

  await assert.rejects(
    () =>
      container.bulkModerateProperties.execute({
        propertyIds: [],
        action: "approve",
        actorId: admin.id,
        actorRoles: ["admin"],
      }),
    ValidationError,
    "empty propertyIds should be rejected",
  );

  await assert.rejects(
    () =>
      container.bulkModerateProperties.execute({
        propertyIds: [p1.id],
        action: "reject",
        actorId: admin.id,
        actorRoles: ["admin"],
      }),
    ValidationError,
    "bulk reject without a reason should be rejected",
  );
});

test("GetPropertyModerationHistoryUseCase: per-property and admin-wide feeds", async () => {
  const container = buildAdminTestContainer();
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin6@example.com" });
  const property = await seedProperty(container, { status: "pending_review" });
  await container.approveProperty.execute({ propertyId: property.id, actorId: admin.id });

  const perProperty = await container.getPropertyModerationHistory.execute({
    propertyId: property.id,
    page: 1,
    pageSize: 10,
  });
  assert.ok(perProperty.total >= 1);

  const recent = await container.getPropertyModerationHistory.execute({ page: 1, pageSize: 10 });
  assert.ok(recent.total >= perProperty.total);
});
