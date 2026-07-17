import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPropertyTestContainer } from "../support/buildPropertyTestContainer";
import { ForbiddenError, NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { CreatePropertyInput } from "@/application/properties/CreateProperty.usecase";

async function setup() {
  const container = buildPropertyTestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
  const category = container.repos.categoryRepo.seed("Apartments", "apartments");
  const input: CreatePropertyInput = {
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

function fakeFiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({ buffer: Buffer.from(`image-${i}`) }));
}

test("UploadPropertyImagesUseCase: first uploaded image becomes primary", async () => {
  const { container, owner, property } = await setup();

  const images = await container.uploadPropertyImages.execute({
    propertyId: property.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    files: fakeFiles(3),
  });

  assert.equal(images.length, 3);
  assert.equal(images[0].isPrimary, true);
  assert.equal(images[1].isPrimary, false);
  assert.equal(images[2].isPrimary, false);
  assert.equal(container.imageStorage.uploaded.length, 3);
});

test("UploadPropertyImagesUseCase: rejects uploads that would exceed the 10-image maximum", async () => {
  const { container, owner, property } = await setup();

  await container.uploadPropertyImages.execute({
    propertyId: property.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    files: fakeFiles(8),
  });

  await assert.rejects(
    () =>
      container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: fakeFiles(3),
      }),
    ValidationError,
  );

  // Exactly 2 more should still be allowed (8 + 2 = 10).
  const topUp = await container.uploadPropertyImages.execute({
    propertyId: property.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    files: fakeFiles(2),
  });
  assert.equal(topUp.length, 2);
  assert.equal(await container.repos.imageRepo.countForProperty(property.id), 10);
});

test("UploadPropertyImagesUseCase: rejects empty upload and non-owner uploads", async () => {
  const { container, owner, property } = await setup();
  const stranger = await container.repos.userRepo.create({ name: "Stranger", email: "s@example.com" });

  await assert.rejects(
    () =>
      container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
        files: [],
      }),
    ValidationError,
  );

  await assert.rejects(
    () =>
      container.uploadPropertyImages.execute({
        propertyId: property.id,
        requesterId: stranger.id,
        requesterRoles: ["customer"],
        files: fakeFiles(1),
      }),
    ForbiddenError,
  );
});

test("DeletePropertyImageUseCase: auto-promotes the next image when the primary is deleted", async () => {
  const { container, owner, property } = await setup();
  const images = await container.uploadPropertyImages.execute({
    propertyId: property.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    files: fakeFiles(3),
  });

  assert.equal(images[0].isPrimary, true);

  await container.deletePropertyImage.execute({
    propertyId: property.id,
    imageId: images[0].id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
  });

  const remaining = await container.repos.imageRepo.listForProperty(property.id);
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].id, images[1].id);
  assert.equal(remaining[0].isPrimary, true, "the next image by sort order should be promoted to primary");
  assert.equal(container.imageStorage.destroyed.length, 1);
  assert.equal(container.imageStorage.destroyed[0], images[0].cloudinaryPublicId);
});

test("DeletePropertyImageUseCase: 404s for an image that doesn't belong to the property", async () => {
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

  await assert.rejects(
    () =>
      container.deletePropertyImage.execute({
        propertyId: property.id,
        imageId: image.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
      }),
    NotFoundError,
  );
});

test("FavoriteProperty / UnfavoriteProperty: idempotent and maintains a denormalized favorite count", async () => {
  const { container, property } = await setup();
  const user = await container.repos.userRepo.create({ name: "Fan", email: "fan@example.com" });

  await container.favoriteProperty.execute(property.id, user.id);
  await container.favoriteProperty.execute(property.id, user.id); // idempotent -- no double count

  const afterFavorite = container.repos.propertyRepo.properties.get(property.id);
  assert.equal(afterFavorite?.favoriteCount, 1);
  assert.equal(container.repos.activityLogRepo.entries.length, 1);

  await container.unfavoriteProperty.execute(property.id, user.id);
  const afterUnfavorite = container.repos.propertyRepo.properties.get(property.id);
  assert.equal(afterUnfavorite?.favoriteCount, 0);

  await container.unfavoriteProperty.execute(property.id, user.id); // idempotent -- no negative count
  const afterSecondUnfavorite = container.repos.propertyRepo.properties.get(property.id);
  assert.equal(afterSecondUnfavorite?.favoriteCount, 0);
  assert.equal(container.repos.activityLogRepo.entries.length, 2);
});

test("ReportProperty: one report per user per property, duplicate raises ConflictError", async () => {
  const { container, property } = await setup();
  const reporter = await container.repos.userRepo.create({ name: "Reporter", email: "r@example.com" });

  await container.reportProperty.execute({
    propertyId: property.id,
    reporterUserId: reporter.id,
    reason: "spam",
    details: "Looks fake",
  });

  await assert.rejects(
    () =>
      container.reportProperty.execute({
        propertyId: property.id,
        reporterUserId: reporter.id,
        reason: "duplicate_listing",
      }),
    /already reported/,
  );

  assert.equal(container.repos.reportRepo.reports.length, 1);
  assert.equal(container.repos.auditLogRepo.entries.length, 1);
});

test("GetMyProperties / GetMyFavorites: return only the requesting user's data, paginated", async () => {
  const container = buildPropertyTestContainer();
  const owner = await container.repos.userRepo.create({ name: "Owner", email: "owner@example.com" });
  const other = await container.repos.userRepo.create({ name: "Other", email: "other@example.com" });
  const category = container.repos.categoryRepo.seed("Apartments", "apartments");

  const makeListing = (ownerId: string, title: string) =>
    container.createProperty.execute({
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
  assert.equal(mine.total, 2);
  assert.ok(mine.items.every((i) => i.owner?.id === owner.id));

  const viewer = await container.repos.userRepo.create({ name: "Viewer", email: "viewer@example.com" });
  await container.favoriteProperty.execute(p1.id, viewer.id);

  const favorites = await container.getMyFavorites.execute({ userId: viewer.id, page: 1, pageSize: 20 });
  assert.equal(favorites.total, 1);
  assert.equal(favorites.items[0].id, p1.id);

  const noFavorites = await container.getMyFavorites.execute({ userId: owner.id, page: 1, pageSize: 20 });
  assert.equal(noFavorites.total, 0);
});
