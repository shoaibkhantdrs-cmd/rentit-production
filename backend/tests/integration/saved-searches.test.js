"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPhase5TestContainer_1 = require("../support/buildPhase5TestContainer");
const AppError_1 = require("@/domain/errors/AppError");
const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
(0, node_test_1.test)("CreateSavedSearchUseCase: requires a name and persists the filters as given", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const user = await container.repos.userRepo.create({ name: "Searcher", email: "searcher@example.com" });
    await strict_1.default.rejects(() => container.createSavedSearch.execute({
        userId: user.id,
        name: "   ",
        filters: {},
        notifyOnMatch: true,
    }), AppError_1.ValidationError);
    const search = await container.createSavedSearch.execute({
        userId: user.id,
        name: "2BHK under 20k",
        filters: { categoryId: CATEGORY_ID, rentMax: 20000 },
        notifyOnMatch: true,
    });
    strict_1.default.equal(search.name, "2BHK under 20k");
    strict_1.default.equal(search.notifyOnMatch, true);
    const list = await container.listSavedSearches.execute(user.id);
    strict_1.default.equal(list.length, 1);
});
(0, node_test_1.test)("UpdateSavedSearchUseCase/DeleteSavedSearchUseCase: only the owner may modify their saved search", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-ss@example.com" });
    const stranger = await container.repos.userRepo.create({ name: "Stranger", email: "stranger@example.com" });
    const search = await container.createSavedSearch.execute({
        userId: owner.id,
        name: "Original name",
        filters: {},
        notifyOnMatch: false,
    });
    await strict_1.default.rejects(() => container.updateSavedSearch.execute({
        savedSearchId: search.id,
        requesterId: stranger.id,
        name: "Hijacked",
    }), AppError_1.ForbiddenError);
    const updated = await container.updateSavedSearch.execute({
        savedSearchId: search.id,
        requesterId: owner.id,
        notifyOnMatch: true,
    });
    strict_1.default.equal(updated.notifyOnMatch, true);
    strict_1.default.equal(updated.name, "Original name", "fields not included in the patch should be untouched");
    await strict_1.default.rejects(() => container.deleteSavedSearch.execute({ savedSearchId: search.id, requesterId: stranger.id }), AppError_1.ForbiddenError);
    await container.deleteSavedSearch.execute({ savedSearchId: search.id, requesterId: owner.id });
    const list = await container.listSavedSearches.execute(owner.id);
    strict_1.default.equal(list.length, 0);
    await strict_1.default.rejects(() => container.updateSavedSearch.execute({ savedSearchId: search.id, requesterId: owner.id, name: "x" }), AppError_1.NotFoundError, "a deleted saved search should behave as not found");
});
(0, node_test_1.test)("NotifySavedSearchesForPropertyUseCase: notifies matching searches, skips non-matches, respects push preference", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
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
    strict_1.default.equal(seekerNotifications.total, 1, "only the matching saved search should notify");
    strict_1.default.equal(seekerNotifications.items[0].type, "saved_search.match");
    const optedOutNotifications = await container.repos.notificationRepo.listForUser(optedOut.id, {
        page: 1,
        pageSize: 10,
    });
    strict_1.default.equal(optedOutNotifications.total, 0);
    const pushEvents = container.pushService.sent.filter((p) => p.userId === seeker.id);
    strict_1.default.equal(pushEvents.length, 1);
    const quietPushEvents = container.pushService.sent.filter((p) => p.userId === pushDisabledSeeker.id);
    strict_1.default.equal(quietPushEvents.length, 0, "push should be suppressed for the opted-out-of-push user");
    const quietNotifications = await container.repos.notificationRepo.listForUser(pushDisabledSeeker.id, {
        page: 1,
        pageSize: 10,
    });
    strict_1.default.equal(quietNotifications.total, 1, "in-app notification still recorded even without push");
});
