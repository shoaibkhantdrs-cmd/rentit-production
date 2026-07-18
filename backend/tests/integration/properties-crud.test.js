"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPropertyTestContainer_1 = require("../support/buildPropertyTestContainer");
const AppError_1 = require("@/domain/errors/AppError");
async function setupOwnerAndCategory(container) {
    const owner = await container.repos.userRepo.create({
        name: "Priya Sharma",
        email: "priya@example.com",
    });
    const category = container.repos.categoryRepo.seed("Apartments", "apartments");
    return { owner, category };
}
function baseCreateInput(ownerId, categoryId) {
    return {
        ownerId,
        title: "  Spacious 2BHK near tech park  ",
        description: "  Bright, airy apartment with a balcony.  ",
        categoryId,
        propertyType: "apartment",
        rentAmount: 35000,
        securityDeposit: 70000,
        areaSqft: 950,
        bedrooms: 2,
        bathrooms: 2,
        parkingSpaces: 1,
        furnishedStatus: "semi_furnished",
        availableFrom: "2026-08-01",
        features: ["lift", "security", "power_backup"],
        location: {
            addressLine: "221B Baner Road",
            city: "Pune",
            locality: "Baner",
            latitude: 18.5642,
            longitude: 73.7769,
        },
    };
}
(0, node_test_1.test)("CreatePropertyUseCase: creates a property with location, features, and status history", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const result = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    strict_1.default.equal(result.title, "Spacious 2BHK near tech park");
    strict_1.default.equal(result.description, "Bright, airy apartment with a balcony.");
    strict_1.default.equal(result.status, "draft");
    strict_1.default.equal(result.category?.slug, "apartments");
    strict_1.default.equal(result.owner?.id, owner.id);
    strict_1.default.equal(result.location?.city, "Pune");
    strict_1.default.equal(result.location?.latitude, 18.5642);
    strict_1.default.deepEqual(result.features.sort(), ["lift", "power_backup", "security"]);
    strict_1.default.equal(result.images.length, 0);
    strict_1.default.equal(result.isFavorited, false);
    strict_1.default.equal(container.repos.statusHistoryRepo.entries.length, 1);
    strict_1.default.equal(container.repos.statusHistoryRepo.entries[0].newStatus, "draft");
    strict_1.default.equal(container.repos.statusHistoryRepo.entries[0].previousStatus, null);
    // No explicit lat/lng omission in this test, so the geocoder should not
    // have been called.
    strict_1.default.equal(container.geocodingService.calls.length, 0);
});
(0, node_test_1.test)("CreatePropertyUseCase: geocodes the address when lat/lng are not supplied", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const input = baseCreateInput(owner.id, category.id);
    delete input.location.latitude;
    delete input.location.longitude;
    const result = await container.createProperty.execute(input);
    strict_1.default.equal(container.geocodingService.calls.length, 1);
    strict_1.default.equal(container.geocodingService.calls[0].city, "Pune");
    strict_1.default.equal(result.location?.latitude, container.geocodingService.nextResult.latitude);
    strict_1.default.equal(result.location?.formattedAddress, container.geocodingService.nextResult.formattedAddress);
});
(0, node_test_1.test)("CreatePropertyUseCase: throws NotFoundError for an unknown category", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner } = await setupOwnerAndCategory(container);
    await strict_1.default.rejects(() => container.createProperty.execute(baseCreateInput(owner.id, "00000000-0000-0000-0000-000000000000")), AppError_1.NotFoundError);
});
(0, node_test_1.test)("GetPropertyUseCase: 404s for a stranger viewing an unpublished listing, but owner can see it", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    const stranger = await container.repos.userRepo.create({ name: "Rahul", email: "rahul@example.com" });
    await strict_1.default.rejects(() => container.getProperty.execute({
        propertyId: created.id,
        viewerUserId: stranger.id,
        viewerRoles: ["customer"],
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
    }), AppError_1.NotFoundError);
    const asOwner = await container.getProperty.execute({
        propertyId: created.id,
        viewerUserId: owner.id,
        viewerRoles: ["property_owner"],
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
    });
    strict_1.default.equal(asOwner.id, created.id);
});
(0, node_test_1.test)("GetPropertyUseCase: increments view count once per viewer within the dedup window", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    await container.updateProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        status: "published",
    });
    const viewer = await container.repos.userRepo.create({ name: "Viewer", email: "viewer@example.com" });
    const viewArgs = {
        propertyId: created.id,
        viewerUserId: viewer.id,
        viewerRoles: ["customer"],
        ipAddress: "9.9.9.9",
        userAgent: "test-agent",
    };
    const first = await container.getProperty.execute(viewArgs);
    strict_1.default.equal(first.viewCount, 1);
    const second = await container.getProperty.execute(viewArgs);
    strict_1.default.equal(second.viewCount, 1, "a second view within 30 minutes should not double-count");
    container.clock.advance(31 * 60_000);
    const third = await container.getProperty.execute(viewArgs);
    strict_1.default.equal(third.viewCount, 2, "a view after the dedup window should count again");
});
(0, node_test_1.test)("UpdatePropertyUseCase: owner can update fields, records status history on status change", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    const updated = await container.updateProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        rentAmount: 40000,
        status: "published",
    });
    strict_1.default.equal(updated.rentAmount, 40000);
    strict_1.default.equal(updated.status, "published");
    strict_1.default.equal(updated.publishedAt !== null, true);
    const historyEntries = container.repos.statusHistoryRepo.entries;
    strict_1.default.equal(historyEntries.length, 2); // created (draft) + published
    strict_1.default.equal(historyEntries[1].previousStatus, "draft");
    strict_1.default.equal(historyEntries[1].newStatus, "published");
});
(0, node_test_1.test)("UpdatePropertyUseCase: re-geocodes only when address changes without explicit coordinates", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    strict_1.default.equal(container.geocodingService.calls.length, 0);
    await container.updateProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        location: { addressLine: "New Address, Kothrud", city: "Pune" },
    });
    strict_1.default.equal(container.geocodingService.calls.length, 1, "address change without lat/lng should re-geocode");
    await container.updateProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        location: { addressLine: "Another Address", city: "Pune", latitude: 1, longitude: 2 },
    });
    strict_1.default.equal(container.geocodingService.calls.length, 1, "explicit lat/lng should skip geocoding even when the address changes");
});
(0, node_test_1.test)("UpdatePropertyUseCase: a stranger cannot update someone else's property", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    const stranger = await container.repos.userRepo.create({ name: "Rahul", email: "rahul@example.com" });
    await strict_1.default.rejects(() => container.updateProperty.execute({
        propertyId: created.id,
        requesterId: stranger.id,
        requesterRoles: ["customer"],
        rentAmount: 99999,
    }), AppError_1.ForbiddenError);
});
(0, node_test_1.test)("UpdatePropertyUseCase: an admin can update a property they do not own", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });
    const updated = await container.updateProperty.execute({
        propertyId: created.id,
        requesterId: admin.id,
        requesterRoles: ["admin"],
        rentAmount: 42000,
    });
    strict_1.default.equal(updated.rentAmount, 42000);
});
(0, node_test_1.test)("DeletePropertyUseCase: soft-deletes and records a 'removed' status history entry", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const { owner, category } = await setupOwnerAndCategory(container);
    const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
    await container.deleteProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
    });
    const stored = container.repos.propertyRepo.properties.get(created.id);
    strict_1.default.ok(stored?.deletedAt);
    await strict_1.default.rejects(() => container.deleteProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
    }), AppError_1.NotFoundError, "deleting an already-deleted property should 404");
    const history = container.repos.statusHistoryRepo.entries;
    strict_1.default.equal(history[history.length - 1].newStatus, "removed");
});
