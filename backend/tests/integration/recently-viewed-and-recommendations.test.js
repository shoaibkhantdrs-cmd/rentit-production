"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPhase5TestContainer_1 = require("../support/buildPhase5TestContainer");
const CATEGORY_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_CATEGORY_ID = "00000000-0000-0000-0000-000000000002";
async function publishedProperty(container, ownerId, overrides) {
    const property = await container.repos.propertyRepo.create({
        ownerId,
        categoryId: overrides.categoryId ?? CATEGORY_ID,
        title: overrides.title,
        description: "desc",
        propertyType: "apartment",
        rentAmount: overrides.rentAmount,
        securityDeposit: overrides.rentAmount * 2,
        areaSqft: 700,
        bedrooms: 2,
        bathrooms: 1,
        parkingSpaces: 1,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    await container.repos.propertyRepo.update(property.id, { status: "published", publishedAt: new Date() });
    if (overrides.city) {
        await container.repos.locationRepo.upsert({
            propertyId: property.id,
            addressLine: "1 Test St",
            city: overrides.city,
            locality: null,
            state: null,
            country: null,
            postalCode: null,
            latitude: 12.9,
            longitude: 77.6,
            formattedAddress: null,
            placeId: null,
        });
    }
    return property;
}
(0, node_test_1.test)("GetRecentlyViewedUseCase: newest-first, deduplicated, and excludes unpublished properties", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-rv@example.com" });
    const viewer = await container.repos.userRepo.create({ name: "Viewer", email: "viewer@example.com" });
    const propA = await publishedProperty(container, owner.id, { title: "Property A", rentAmount: 10000 });
    const propB = await publishedProperty(container, owner.id, { title: "Property B", rentAmount: 12000 });
    const unpublished = await container.repos.propertyRepo.create({
        ownerId: owner.id,
        categoryId: CATEGORY_ID,
        title: "Draft Property",
        description: "desc",
        propertyType: "apartment",
        rentAmount: 9000,
        securityDeposit: 18000,
        areaSqft: 500,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-08-01",
    });
    // View A, then B, then A again (a repeat view should not create a
    // second entry or push A to the back), then the never-published draft.
    await container.repos.propertyViewRepo.record({
        propertyId: propA.id,
        viewerUserId: viewer.id,
        ipAddress: null,
        userAgent: null,
    });
    await container.repos.propertyViewRepo.record({
        propertyId: propB.id,
        viewerUserId: viewer.id,
        ipAddress: null,
        userAgent: null,
    });
    await container.repos.propertyViewRepo.record({
        propertyId: propA.id,
        viewerUserId: viewer.id,
        ipAddress: null,
        userAgent: null,
    });
    await container.repos.propertyViewRepo.record({
        propertyId: unpublished.id,
        viewerUserId: viewer.id,
        ipAddress: null,
        userAgent: null,
    });
    const result = await container.getRecentlyViewed.execute(viewer.id);
    const titles = result.items.map((i) => i.title);
    strict_1.default.deepEqual(titles, ["Property A", "Property B"], "most-recent view of A should win the dedup, draft excluded");
});
(0, node_test_1.test)("GetRecommendationsUseCase (by property): same category, similar price band, excludes the seed itself", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-rec@example.com" });
    const seed = await publishedProperty(container, owner.id, { title: "Seed Listing", rentAmount: 20000, city: "Pune" });
    const closeMatch = await publishedProperty(container, owner.id, {
        title: "Similar Listing",
        rentAmount: 21000,
        city: "Pune",
    });
    await publishedProperty(container, owner.id, {
        title: "Too Expensive",
        rentAmount: 50000,
        city: "Pune",
    });
    await publishedProperty(container, owner.id, {
        title: "Wrong Category",
        rentAmount: 20500,
        categoryId: OTHER_CATEGORY_ID,
        city: "Pune",
    });
    const result = await container.getRecommendations.execute({ propertyId: seed.id });
    const titles = result.items.map((i) => i.title);
    strict_1.default.ok(titles.includes("Similar Listing"));
    strict_1.default.ok(!titles.includes("Seed Listing"), "the seed property should never recommend itself");
    strict_1.default.ok(!titles.includes("Too Expensive"));
    strict_1.default.ok(!titles.includes("Wrong Category"));
    strict_1.default.equal(closeMatch.categoryId, seed.categoryId);
});
(0, node_test_1.test)("GetRecommendationsUseCase (for a user): derives category/price from their favorites", async () => {
    const container = (0, buildPhase5TestContainer_1.buildPhase5TestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner-favrec@example.com" });
    const user = await container.repos.userRepo.create({ name: "User", email: "user-favrec@example.com" });
    const favorited = await publishedProperty(container, owner.id, { title: "Favorited One", rentAmount: 15000 });
    await container.repos.propertyFavoriteRepo.add(favorited.id, user.id);
    const matchingNew = await publishedProperty(container, owner.id, {
        title: "Fresh Match",
        rentAmount: 15500,
    });
    await publishedProperty(container, owner.id, {
        title: "Unrelated Category",
        rentAmount: 15200,
        categoryId: OTHER_CATEGORY_ID,
    });
    const result = await container.getRecommendations.execute({ userId: user.id });
    const titles = result.items.map((i) => i.title);
    strict_1.default.ok(titles.includes("Fresh Match"));
    strict_1.default.ok(!titles.includes("Unrelated Category"));
    strict_1.default.equal(matchingNew.categoryId, favorited.categoryId);
});
