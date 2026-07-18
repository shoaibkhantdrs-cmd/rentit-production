"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPropertyTestContainer_1 = require("../support/buildPropertyTestContainer");
const AppError_1 = require("@/domain/errors/AppError");
async function setup() {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
    const category = container.repos.categoryRepo.seed("Apartments", "apartments");
    const input = {
        ownerId: owner.id,
        title: "Listing",
        description: "Description",
        categoryId: category.id,
        propertyType: "apartment",
        rentAmount: 20000,
        securityDeposit: 40000,
        areaSqft: 800,
        bedrooms: 2,
        bathrooms: 1,
        parkingSpaces: 1,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-01-01",
        location: { addressLine: "Road", city: "Pune", latitude: 18.5, longitude: 73.8 },
    };
    const property = await container.createProperty.execute(input);
    return { container, owner, property };
}
function fakeFiles(count) {
    return Array.from({ length: count }, (_, i) => ({ buffer: Buffer.from(`image-${i}`) }));
}
(0, node_test_1.test)("UploadPropertyImagesUseCase: first uploaded image becomes primary", async () => {
    const { container, owner, property } = await setup();
    const images = await container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(3),
    });
    strict_1.default.equal(images.length, 3);
    strict_1.default.equal(images[0].isPrimary, true);
    strict_1.default.equal(images[1].isPrimary, false);
    strict_1.default.equal(images[2].isPrimary, false);
    strict_1.default.equal(container.imageStorage.uploaded.length, 3);
});
(0, node_test_1.test)("UploadPropertyImagesUseCase: rejects uploads that would exceed the 10-image maximum", async () => {
    const { container, owner, property } = await setup();
    await container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(8),
    });
    await strict_1.default.rejects(() => container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(3),
    }), AppError_1.ValidationError);
    // Exactly 2 more should still be allowed (8 + 2 = 10).
    const topUp = await container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(2),
    });
    strict_1.default.equal(topUp.length, 2);
    strict_1.default.equal(await container.repos.imageRepo.countForProperty(property.id), 10);
});
(0, node_test_1.test)("UploadPropertyImagesUseCase: rejects empty upload and non-owner uploads", async () => {
    const { container, owner, property } = await setup();
    const stranger = await container.repos.userRepo.create({ name: "Stranger", email: "s@example.com" });
    await strict_1.default.rejects(() => container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: [],
    }), AppError_1.ValidationError);
    await strict_1.default.rejects(() => container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: stranger.id,
        requesterRoles: ["customer"],
        files: fakeFiles(1),
    }), AppError_1.ForbiddenError);
});
(0, node_test_1.test)("DeletePropertyImageUseCase: auto-promotes the next image when the primary is deleted", async () => {
    const { container, owner, property } = await setup();
    const images = await container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(3),
    });
    strict_1.default.equal(images[0].isPrimary, true);
    await container.deletePropertyImage.execute({
        propertyId: property.id,
        imageId: images[0].id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
    });
    const remaining = await container.repos.imageRepo.listForProperty(property.id);
    strict_1.default.equal(remaining.length, 2);
    strict_1.default.equal(remaining[0].id, images[1].id);
    strict_1.default.equal(remaining[0].isPrimary, true, "the next image by sort order should be promoted to primary");
    strict_1.default.equal(container.imageStorage.destroyed.length, 1);
    strict_1.default.equal(container.imageStorage.destroyed[0], images[0].cloudinaryPublicId);
});
(0, node_test_1.test)("DeletePropertyImageUseCase: 404s for an image that doesn't belong to the property", async () => {
    const { container, owner, property } = await setup();
    const other = await container.repos.userRepo.create({ name: "Other Owner", email: "other@example.com" });
    const otherCategory = container.repos.categoryRepo.seed("Villas", "villas");
    const otherProperty = await container.createProperty.execute({
        ownerId: other.id,
        title: "Other listing",
        description: "d",
        categoryId: otherCategory.id,
        propertyType: "villa",
        rentAmount: 1000,
        securityDeposit: 1000,
        areaSqft: 100,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-01-01",
        location: { addressLine: "Road", city: "Pune", latitude: 18.5, longitude: 73.8 },
    });
    const [image] = await container.uploadPropertyImages.execute({
        propertyId: otherProperty.id,
        requesterId: other.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(1),
    });
    await strict_1.default.rejects(() => container.deletePropertyImage.execute({
        propertyId: property.id,
        imageId: image.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
    }), AppError_1.NotFoundError);
});
(0, node_test_1.test)("FavoriteProperty / UnfavoriteProperty: idempotent and maintains a denormalized favorite count", async () => {
    const { container, property } = await setup();
    const user = await container.repos.userRepo.create({ name: "Fan", email: "fan@example.com" });
    await container.favoriteProperty.execute(property.id, user.id);
    await container.favoriteProperty.execute(property.id, user.id); // idempotent -- no double count
    const afterFavorite = container.repos.propertyRepo.properties.get(property.id);
    strict_1.default.equal(afterFavorite?.favoriteCount, 1);
    strict_1.default.equal(container.repos.activityLogRepo.entries.length, 1);
    await container.unfavoriteProperty.execute(property.id, user.id);
    const afterUnfavorite = container.repos.propertyRepo.properties.get(property.id);
    strict_1.default.equal(afterUnfavorite?.favoriteCount, 0);
    await container.unfavoriteProperty.execute(property.id, user.id); // idempotent -- no negative count
    const afterSecondUnfavorite = container.repos.propertyRepo.properties.get(property.id);
    strict_1.default.equal(afterSecondUnfavorite?.favoriteCount, 0);
    strict_1.default.equal(container.repos.activityLogRepo.entries.length, 2);
});
(0, node_test_1.test)("ReportProperty: one report per user per property, duplicate raises ConflictError", async () => {
    const { container, property } = await setup();
    const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "r@example.com" });
    await container.reportProperty.execute({
        propertyId: property.id,
        reporterUserId: reporter.id,
        reason: "spam",
        details: "Looks fake",
    });
    await strict_1.default.rejects(() => container.reportProperty.execute({
        propertyId: property.id,
        reporterUserId: reporter.id,
        reason: "duplicate_listing",
    }), /already reported/);
    strict_1.default.equal(container.repos.reportRepo.reports.length, 1);
    strict_1.default.equal(container.repos.auditLogRepo.entries.length, 1);
});
(0, node_test_1.test)("GetMyProperties / GetMyFavorites: return only the requesting user's data, paginated", async () => {
    const container = (0, buildPropertyTestContainer_1.buildPropertyTestContainer)();
    const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
    const other = await container.repos.userRepo.create({ name: "Other", email: "other@example.com" });
    const category = container.repos.categoryRepo.seed("Apartments", "apartments");
    const makeListing = (ownerId, title) => container.createProperty.execute({
        ownerId,
        title,
        description: "d",
        categoryId: category.id,
        propertyType: "apartment",
        rentAmount: 1000,
        securityDeposit: 1000,
        areaSqft: 100,
        bedrooms: 1,
        bathrooms: 1,
        parkingSpaces: 0,
        furnishedStatus: "unfurnished",
        availableFrom: "2026-01-01",
        location: { addressLine: "Road", city: "Pune", latitude: 18.5, longitude: 73.8 },
    });
    const p1 = await makeListing(owner.id, "Owner Listing 1");
    await makeListing(owner.id, "Owner Listing 2");
    await makeListing(other.id, "Other's Listing");
    const mine = await container.getMyProperties.execute({ ownerId: owner.id, page: 1, pageSize: 20 });
    strict_1.default.equal(mine.total, 2);
    strict_1.default.ok(mine.items.every((i) => i.owner?.id === owner.id));
    const viewer = await container.repos.userRepo.create({ name: "Viewer", email: "viewer@example.com" });
    await container.favoriteProperty.execute(p1.id, viewer.id);
    const favorites = await container.getMyFavorites.execute({ userId: viewer.id, page: 1, pageSize: 20 });
    strict_1.default.equal(favorites.total, 1);
    strict_1.default.equal(favorites.items[0].id, p1.id);
    const noFavorites = await container.getMyFavorites.execute({ userId: owner.id, page: 1, pageSize: 20 });
    strict_1.default.equal(noFavorites.total, 0);
});
