import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPhase5TestContainer } from "../support/buildPhase5TestContainer";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors/AppError";

const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";

test("CreateSavedSearchUseCase: requires a name and persists the filters as given", async () => {
  const container = buildPhase5TestContainer();
  const user = await container.repos.userRepo.create({ name: "Searcher", email: "searcher@example.com" });

  await assert.rejects(
    () =>
      container.createSavedSearch.execute({
        userId: user.id,
        name: "   ",
        filters: {},
        notifyOnMatch: true,
      }),
    ValidationError,
  );

  const search = await container.createSavedSearch.execute({
    userId: user.id,
    name: "2BHK under 20k",
    filters: { categoryId: CATEGORY_ID, rentMax: 20000 },
    notifyOnMatch: true,
  });
  assert.equal(search.name, "2BHK under 20k");
  assert.equal(search.notifyOnMatch, true);

  const list = await container.listSavedSearches.execute(user.id);
  assert.equal(list.length, 1);
});

test("UpdateSavedSearchUseCase/DeleteSavedSearchUseCase: only the owner may modify their saved search", async () => {
  const container = buildPhase5TestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-ss@example.com" });
  const stranger = await container.repos.userRepo.create({ name: "Stranger", email: "stranger@example.com" });

  const search = await container.createSavedSearch.execute({
    userId: owner.id,
    name: "Original name",
    filters: {},
    notifyOnMatch: false,
  });

  await assert.rejects(
    () =>
      container.updateSavedSearch.execute({
        savedSearchId: search.id,
        requesterId: stranger.id,
        name: "Hijacked",
      }),
    ForbiddenError,
  );

  const updated = await container.updateSavedSearch.execute({
    savedSearchId: search.id,
    requesterId: owner.id,
    notifyOnMatch: true,
  });
  assert.equal(updated.notifyOnMatch, true);
  assert.equal(updated.name, "Original name", "fields not included in the patch should be untouched");

  await assert.rejects(
    () => container.deleteSavedSearch.execute({ savedSearchId: search.id, requesterId: stranger.id }),
    ForbiddenError,
  );
  await container.deleteSavedSearch.execute({ savedSearchId: search.id, requesterId: owner.id });

  const list = await container.listSavedSearches.execute(owner.id);
  assert.equal(list.length, 0);

  await assert.rejects(
    () => container.updateSavedSearch.execute({ savedSearchId: search.id, requesterId: owner.id, name: "x" }),
    NotFoundError,
    "a deleted saved search should behave as not found",
  );
});

test("NotifySavedSearchesForPropertyUseCase: notifies matching searches, skips non-matches, respects push preference", async () => {
  const container = buildPhase5TestContainer();
  const seeker = await container.repos.userRepo.create({ name: "Seeker", email: "seeker@example.com" });
  const pushDisabledSeeker = await container.repos.userRepo.create({
    name: "Quiet Seeker",
    email: "quiet-seeker@example.com",
  });
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-notify@example.com" });

  await container.createSavedSearch.execute({
    userId: seeker.id,
    name: "Cheap apartments",
    filters: { categoryId: CATEGORY_ID, rentMax: 15000 },
    notifyOnMatch: true,
  });
  await container.createSavedSearch.execute({
    userId: pushDisabledSeeker.id,
    name: "Cheap apartments too",
    filters: { categoryId: CATEGORY_ID, rentMax: 15000 },
    notifyOnMatch: true,
  });
  await container.updateNotificationPreferences.execute({
    userId: pushDisabledSeeker.id,
    categories: { newProperties: false },
  });
  // A search that should NOT match the property below (rent too low a ceiling).
  await container.createSavedSearch.execute({
    userId: seeker.id,
    name: "Very cheap only",
    filters: { categoryId: CATEGORY_ID, rentMax: 5000 },
    notifyOnMatch: true,
  });
  // notifyOnMatch = false should never fire regardless of filter match.
  const optedOut = await container.repos.userRepo.create({ name: "Opted Out", email: "opted-out@example.com" });
  await container.createSavedSearch.execute({
    userId: optedOut.id,
    name: "Silent search",
    filters: { categoryId: CATEGORY_ID, rentMax: 15000 },
    notifyOnMatch: false,
  });

  const property = await container.repos.propertyRepo.create({
    ownerId: owner.id,
    categoryId: CATEGORY_ID,
    title: "Budget 1BHK",
    description: "desc",
    propertyType: "apartment",
    rentAmount: 12000,
    securityDeposit: 24000,
    areaSqft: 500,
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 0,
    furnishedStatus: "unfurnished",
    availableFrom: "2026-08-01",
  });

  await container.notifySavedSearchesForProperty.execute(property);

  const seekerNotifications = await container.repos.notificationRepo.listForUser(seeker.id, {
    page: 1,
    pageSize: 10,
  });
  assert.equal(seekerNotifications.total, 1, "only the matching saved search should notify");
  assert.equal(seekerNotifications.items[0].type, "saved_search.match");

  const optedOutNotifications = await container.repos.notificationRepo.listForUser(optedOut.id, {
    page: 1,
    pageSize: 10,
  });
  assert.equal(optedOutNotifications.total, 0);

  const pushEvents = container.pushService.sent.filter((p) => p.userId === seeker.id);
  assert.equal(pushEvents.length, 1);
  const quietPushEvents = container.pushService.sent.filter((p) => p.userId === pushDisabledSeeker.id);
  assert.equal(quietPushEvents.length, 0, "push should be suppressed for the opted-out-of-push user");

  const quietNotifications = await container.repos.notificationRepo.listForUser(pushDisabledSeeker.id, {
    page: 1,
    pageSize: 10,
  });
  assert.equal(quietNotifications.total, 1, "in-app notification still recorded even without push");
});
