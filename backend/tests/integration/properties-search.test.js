"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPropertyTestContainer_1 = require("../support/buildPropertyTestContainer");
async function seedListing(container, ownerId, categoryId, overrides = {}) {
    const { publish = true, ...rest } = overrides;
    const input = {
        ownerId,
        title: "Listing",
        description: "Description",
        categoryId,
        propertyType: "apartment",
        rentAmount: 20000,
        securityDeposit: 40000,
        areaSqft: 800,
        bedrooms: 2,
        bathrooms: 1,
        parkingSpaces: 1,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-01-01",
        location: { addressLine: "Some road", city: "Pune", latitude: 18.5204, longitude: 73.8567 },
        ...rest,
    };
    const created = await container.createProperty.execute(input);
    if (publish) {
        await container.updateProperty.execute({
            propertyId: created.id,
            requesterId: ownerId,
            requesterRoles: ["property_owner"],
            status: "published",
        });
    }
    return created;
}
async function setup() {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
    const category = container.repos.categoryRepo.seed("Apartments", "apartments");
    return { container, owner, category };
}
(0, node_test_1.test)("SearchPropertiesUseCase: excludes unpublished and soft-deleted listings", async () => {
    const { container, owner, category } = await setup();
    await seedListing(container, owner.id, category.id, { title: "Published", publish: true });
    const draft = await seedListing(container, owner.id, category.id, { title: "Draft", publish: false });
    const removed = await seedListing(container, owner.id, category.id, { title: "Removed", publish: true });
    await container.deleteProperty.execute({
        propertyId: removed.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
    });
    const result = await container.searchProperties.execute({ sort: "newest", page: 1, pageSize: 20 });
    strict_1.default.equal(result.items.length, 1);
    strict_1.default.equal(result.items[0].title, "Published");
    strict_1.default.ok(!result.items.some((i) => i.title === draft.title));
});
(0, node_test_1.test)("SearchPropertiesUseCase: filters by bedrooms, rent range, and furnished status", async () => {
    const { container, owner, category } = await setup();
    await seedListing(container, owner.id, category.id, {
        title: "Cheap studio",
        bedrooms: 1,
        rentAmount: 8000,
        furnishedStatus: "unfurnished",
    });
    await seedListing(container, owner.id, category.id, {
        title: "Mid-range 2BHK",
        bedrooms: 2,
        rentAmount: 25000,
        furnishedStatus: "semi_furnished",
    });
    await seedListing(container, owner.id, category.id, {
        title: "Luxury 3BHK",
        bedrooms: 3,
        rentAmount: 60000,
        furnishedStatus: "fully_furnished",
    });
    const result = await container.searchProperties.execute({
        bedroomsMin: 2,
        rentMin: 10000,
        rentMax: 30000,
        sort: "newest",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(result.items.length, 1);
    strict_1.default.equal(result.items[0].title, "Mid-range 2BHK");
    const furnished = await container.searchProperties.execute({
        furnished: "fully_furnished",
        sort: "newest",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(furnished.items.length, 1);
    strict_1.default.equal(furnished.items[0].title, "Luxury 3BHK");
});
(0, node_test_1.test)("SearchPropertiesUseCase: city filter is a case-insensitive substring match", async () => {
    const { container, owner, category } = await setup();
    await seedListing(container, owner.id, category.id, {
        title: "Pune Listing",
        location: { addressLine: "Road", city: "Pune", latitude: 18.5, longitude: 73.8 },
    });
    await seedListing(container, owner.id, category.id, {
        title: "Mumbai Listing",
        location: { addressLine: "Road", city: "Mumbai", latitude: 19.0, longitude: 72.8 },
    });
    const result = await container.searchProperties.execute({
        city: "pune",
        sort: "newest",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(result.items.length, 1);
    strict_1.default.equal(result.items[0].title, "Pune Listing");
});
(0, node_test_1.test)("SearchPropertiesUseCase: unknown category slug returns an empty result, not an error", async () => {
    const { container, owner, category } = await setup();
    await seedListing(container, owner.id, category.id, {});
    const result = await container.searchProperties.execute({
        categorySlug: "does-not-exist",
        sort: "newest",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(result.items.length, 0);
    strict_1.default.equal(result.total, 0);
});
(0, node_test_1.test)("SearchPropertiesUseCase: each sort option orders results correctly", async () => {
    const { container, owner, category } = await setup();
    const a = await seedListing(container, owner.id, category.id, { title: "A", rentAmount: 30000 });
    const b = await seedListing(container, owner.id, category.id, { title: "B", rentAmount: 10000 });
    const c = await seedListing(container, owner.id, category.id, { title: "C", rentAmount: 20000 });
    const lowToHigh = await container.searchProperties.execute({
        sort: "price_low_to_high",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.deepEqual(lowToHigh.items.map((i) => i.title), ["B", "C", "A"]);
    const highToLow = await container.searchProperties.execute({
        sort: "price_high_to_low",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.deepEqual(highToLow.items.map((i) => i.title), ["A", "C", "B"]);
    // Give B the most views, C fewer, A none, then confirm most_viewed order.
    for (let i = 0; i < 5; i += 1)
        await container.repos.propertyRepo.incrementViewCount(b.id);
    for (let i = 0; i < 2; i += 1)
        await container.repos.propertyRepo.incrementViewCount(c.id);
    await container.repos.propertyRepo.incrementViewCount(a.id);
    // a gets exactly 1 view -- still fewer than c's 2.
    const mostViewed = await container.searchProperties.execute({
        sort: "most_viewed",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.deepEqual(mostViewed.items.map((i) => i.title), ["B", "C", "A"]);
});
(0, node_test_1.test)("SearchPropertiesUseCase: pagination slices results and reports total independent of page size", async () => {
    const { container, owner, category } = await setup();
    for (let i = 0; i < 5; i += 1) {
        await seedListing(container, owner.id, category.id, { title: `Listing ${i}` });
    }
    const page1 = await container.searchProperties.execute({ sort: "newest", page: 1, pageSize: 2 });
    const page2 = await container.searchProperties.execute({ sort: "newest", page: 2, pageSize: 2 });
    const page3 = await container.searchProperties.execute({ sort: "newest", page: 3, pageSize: 2 });
    strict_1.default.equal(page1.total, 5);
    strict_1.default.equal(page1.items.length, 2);
    strict_1.default.equal(page2.items.length, 2);
    strict_1.default.equal(page3.items.length, 1);
    const allTitles = [...page1.items, ...page2.items, ...page3.items].map((i) => i.title);
    strict_1.default.equal(new Set(allTitles).size, 5, "pages should not overlap");
});
(0, node_test_1.test)("SearchPropertiesUseCase: radius search only returns listings within the given distance", async () => {
    const { container, owner, category } = await setup();
    // Center: Pune (18.5204, 73.8567)
    await seedListing(container, owner.id, category.id, {
        title: "Near Pune center",
        location: { addressLine: "Road", city: "Pune", latitude: 18.53, longitude: 73.86 },
    });
    await seedListing(container, owner.id, category.id, {
        title: "Far away in Delhi",
        location: { addressLine: "Road", city: "Delhi", latitude: 28.6139, longitude: 77.209 },
    });
    const result = await container.searchProperties.execute({
        latitude: 18.5204,
        longitude: 73.8567,
        radiusKm: 25,
        sort: "newest",
        page: 1,
        pageSize: 20,
    });
    strict_1.default.equal(result.items.length, 1);
    strict_1.default.equal(result.items[0].title, "Near Pune center");
    strict_1.default.ok(result.items[0].distanceKm !== null && result.items[0].distanceKm < 25);
});
(0, node_test_1.test)("SearchPropertiesUseCase: search results include category name and primary image", async () => {
    const { container, owner, category } = await setup();
    const created = await seedListing(container, owner.id, category.id, { title: "With image" });
    await container.uploadPropertyImages.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: [{ buffer: Buffer.from("fake-image-bytes") }],
    });
    const result = await container.searchProperties.execute({ sort: "newest", page: 1, pageSize: 20 });
    strict_1.default.equal(result.items[0].categoryName, "Apartments");
    strict_1.default.ok(result.items[0].primaryImageUrl?.startsWith("https://res.cloudinary.test/"));
});
