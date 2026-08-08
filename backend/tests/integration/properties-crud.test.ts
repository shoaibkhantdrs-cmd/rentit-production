import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPropertyTestContainer } from "../support/buildPropertyTestContainer";
import { ForbiddenError, NotFoundError } from "@/domain/errors/AppError";
import { CreatePropertyInput } from "@/application/properties/CreateProperty.usecase";
import { updatePropertySchema } from "@/interfaces/http/validators/property.schemas";

async function setupOwnerAndCategory(container: ReturnType<typeof buildPropertyTestContainer>) {
  const owner = await container.repos.userRepo.create({
    name: "Priya Sharma",
    email: "priya@example.com",
  });
  const category = container.repos.categoryRepo.seed("Apartments", "apartments");
  return { owner, category };
}

function baseCreateInput(ownerId: string, categoryId: string): CreatePropertyInput {
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

test("CreatePropertyUseCase: creates a property with location, features, and status history", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const result = await container.createProperty.execute(baseCreateInput(owner.id, category.id));

  assert.equal(result.title, "Spacious 2BHK near tech park");
  assert.equal(result.description, "Bright, airy apartment with a balcony.");
  assert.equal(result.status, "draft");
  assert.equal(result.category?.slug, "apartments");
  assert.equal(result.owner?.id, owner.id);
  assert.equal(result.location?.city, "Pune");
  assert.equal(result.location?.latitude, 18.5642);
  assert.deepEqual(result.features.sort(), ["lift", "power_backup", "security"]);
  assert.equal(result.images.length, 0);
  assert.equal(result.isFavorited, false);

  assert.equal(container.repos.statusHistoryRepo.entries.length, 1);
  assert.equal(container.repos.statusHistoryRepo.entries[0].newStatus, "draft");
  assert.equal(container.repos.statusHistoryRepo.entries[0].previousStatus, null);

  // No explicit lat/lng omission in this test, so the geocoder should not
  // have been called.
  assert.equal(container.geocodingService.calls.length, 0);
});

test("CreatePropertyUseCase: geocodes the address when lat/lng are not supplied", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const input = baseCreateInput(owner.id, category.id);
  delete (input.location as { latitude?: number }).latitude;
  delete (input.location as { longitude?: number }).longitude;

  const result = await container.createProperty.execute(input);

  assert.equal(container.geocodingService.calls.length, 1);
  assert.equal(container.geocodingService.calls[0].city, "Pune");
  assert.equal(result.location?.latitude, container.geocodingService.nextResult.latitude);
  assert.equal(result.location?.formattedAddress, container.geocodingService.nextResult.formattedAddress);
});

test("CreatePropertyUseCase: throws NotFoundError for an unknown category", async () => {
  const container = buildPropertyTestContainer();
  const { owner } = await setupOwnerAndCategory(container);

  await assert.rejects(
    () => container.createProperty.execute(baseCreateInput(owner.id, "00000000-0000-0000-0000-000000000000")),
    NotFoundError,
  );
});

// Phase 3 Part 2, Part 2: CreatePropertyUseCase must never persist the 8
// shop-only fields for a non-shop property, even if the caller directly
// sends values for them -- mirrors UpdatePropertyUseCase's existing guard
// (c2fe84b), which only ran on edit, not on create.

test("CreatePropertyUseCase: non-shop create with malicious/extra shop values stores all eight as null", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const result = await container.createProperty.execute({
    ...baseCreateInput(owner.id, category.id),
    propertyType: "apartment",
    // A caller directly hitting the API (buggy client, stale form state,
    // or a malicious request) sends shop-only values alongside a non-shop
    // propertyType.
    frontWidthFt: 25,
    shopDepthFt: 35,
    roadWidthFt: 45,
    powerLoad: "10 kW",
    isCornerShop: true,
    hasWashroom: true,
    readyToMove: true,
    suitableFor: ["retail", "clothing"],
  });

  assert.equal(result.propertyType, "apartment");

  const stored = container.repos.propertyRepo.properties.get(result.id);
  assert.equal(stored?.frontWidthFt, null);
  assert.equal(stored?.shopDepthFt, null);
  assert.equal(stored?.roadWidthFt, null);
  assert.equal(stored?.powerLoad, null);
  assert.equal(stored?.isCornerShop, null);
  assert.equal(stored?.hasWashroom, null);
  assert.equal(stored?.readyToMove, null);
  assert.equal(stored?.suitableFor, null);
});

test("CreatePropertyUseCase: genuine shop create preserves the supplied shop field values exactly", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const result = await container.createProperty.execute({
    ...baseCreateInput(owner.id, category.id),
    propertyType: "shop",
    floorNumber: 1,
    location: { ...baseCreateInput(owner.id, category.id).location, postalCode: "411045" },
    frontWidthFt: 20,
    shopDepthFt: 30,
    roadWidthFt: 40,
    powerLoad: "5 kW / 3-phase",
    isCornerShop: true,
    hasWashroom: true,
    readyToMove: true,
    suitableFor: ["retail", "clothing"],
  });

  assert.equal(result.propertyType, "shop");

  const stored = container.repos.propertyRepo.properties.get(result.id);
  assert.equal(stored?.frontWidthFt, 20);
  assert.equal(stored?.shopDepthFt, 30);
  assert.equal(stored?.roadWidthFt, 40);
  assert.equal(stored?.powerLoad, "5 kW / 3-phase");
  assert.equal(stored?.isCornerShop, true);
  assert.equal(stored?.hasWashroom, true);
  assert.equal(stored?.readyToMove, true);
  assert.deepEqual(stored?.suitableFor, ["retail", "clothing"]);
});

test("CreatePropertyUseCase: normal non-shop create with no shop fields sent stores all eight as null (existing behavior unchanged)", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const result = await container.createProperty.execute(baseCreateInput(owner.id, category.id));

  const stored = container.repos.propertyRepo.properties.get(result.id);
  assert.equal(stored?.frontWidthFt, null);
  assert.equal(stored?.shopDepthFt, null);
  assert.equal(stored?.roadWidthFt, null);
  assert.equal(stored?.powerLoad, null);
  assert.equal(stored?.isCornerShop, null);
  assert.equal(stored?.hasWashroom, null);
  assert.equal(stored?.readyToMove, null);
  assert.equal(stored?.suitableFor, null);
});

test("GetPropertyUseCase: 404s for a stranger viewing an unpublished listing, but owner can see it", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));

  const stranger = await container.repos.userRepo.create({ name: "Rahul", email: "rahul@example.com" });

  await assert.rejects(
    () =>
      container.getProperty.execute({
        propertyId: created.id,
        viewerUserId: stranger.id,
        viewerRoles: ["customer"],
        ipAddress: "1.2.3.4",
        userAgent: "test-agent",
      }),
    NotFoundError,
  );

  const asOwner = await container.getProperty.execute({
    propertyId: created.id,
    viewerUserId: owner.id,
    viewerRoles: ["property_owner"],
    ipAddress: "1.2.3.4",
    userAgent: "test-agent",
  });
  assert.equal(asOwner.id, created.id);
});

test("GetPropertyUseCase: increments view count once per viewer within the dedup window", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));

  // Owners can only submit a listing for review; only an admin may publish
  // it (UpdatePropertyUseCase's self-publish guard).
  await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    status: "pending_review",
  });
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin-viewcount@example.com" });
  await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: admin.id,
    requesterRoles: ["admin"],
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
  assert.equal(first.viewCount, 1);

  const second = await container.getProperty.execute(viewArgs);
  assert.equal(second.viewCount, 1, "a second view within 30 minutes should not double-count");

  container.clock.advance(31 * 60_000);
  const third = await container.getProperty.execute(viewArgs);
  assert.equal(third.viewCount, 2, "a view after the dedup window should count again");
});

test("UpdatePropertyUseCase: owner can update fields and submit for review; admin approves and publishes; status history records each step", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin-crud@example.com" });

  // Owner can update fields and move their own listing to pending_review in
  // the same call -- only "published" (and reversing an admin "inactive")
  // is admin-only.
  const submitted = await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    rentAmount: 40000,
    status: "pending_review",
  });

  assert.equal(submitted.rentAmount, 40000);
  assert.equal(submitted.status, "pending_review");

  // Only an admin may publish it.
  const published = await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: admin.id,
    requesterRoles: ["admin"],
    status: "published",
  });

  assert.equal(published.rentAmount, 40000);
  assert.equal(published.status, "published");
  assert.equal(published.publishedAt !== null, true);

  const historyEntries = container.repos.statusHistoryRepo.entries;
  assert.equal(historyEntries.length, 3); // created (draft) + pending_review + published
  assert.equal(historyEntries[1].previousStatus, "draft");
  assert.equal(historyEntries[1].newStatus, "pending_review");
  assert.equal(historyEntries[2].previousStatus, "pending_review");
  assert.equal(historyEntries[2].newStatus, "published");
});

test("UpdatePropertyUseCase: re-geocodes only when address changes without explicit coordinates", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
  assert.equal(container.geocodingService.calls.length, 0);

  await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    location: { addressLine: "New Address, Kothrud", city: "Pune" },
  });
  assert.equal(container.geocodingService.calls.length, 1, "address change without lat/lng should re-geocode");

  await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    location: { addressLine: "Another Address", city: "Pune", latitude: 1, longitude: 2 },
  });
  assert.equal(
    container.geocodingService.calls.length,
    1,
    "explicit lat/lng should skip geocoding even when the address changes",
  );
});

test("UpdatePropertyUseCase: clears shop-only fields when propertyType changes away from shop", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const created = await container.createProperty.execute({
    ...baseCreateInput(owner.id, category.id),
    propertyType: "shop",
    frontWidthFt: 20,
    shopDepthFt: 30,
    roadWidthFt: 40,
    powerLoad: "5 kW / 3-phase",
    isCornerShop: true,
    hasWashroom: true,
    readyToMove: true,
    suitableFor: ["retail", "clothing"],
  });

  const beforeUpdate = container.repos.propertyRepo.properties.get(created.id);
  assert.equal(beforeUpdate?.frontWidthFt, 20);
  assert.deepEqual(beforeUpdate?.suitableFor, ["retail", "clothing"]);

  // Edit it into an apartment WITHOUT explicitly clearing the shop fields --
  // this is exactly what the pre-fix client/usecase combination produced,
  // and is what previously left orphaned shop data on residential rows.
  const updated = await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    propertyType: "apartment",
  });
  assert.equal(updated.propertyType, "apartment");

  const afterUpdate = container.repos.propertyRepo.properties.get(created.id);
  assert.equal(afterUpdate?.propertyType, "apartment");
  assert.equal(afterUpdate?.frontWidthFt, null);
  assert.equal(afterUpdate?.shopDepthFt, null);
  assert.equal(afterUpdate?.roadWidthFt, null);
  assert.equal(afterUpdate?.powerLoad, null);
  assert.equal(afterUpdate?.isCornerShop, null);
  assert.equal(afterUpdate?.hasWashroom, null);
  assert.equal(afterUpdate?.readyToMove, null);
  assert.equal(afterUpdate?.suitableFor, null);
});

test("UpdatePropertyUseCase: overrides shop values a caller still sends alongside a type change away from shop", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const created = await container.createProperty.execute({
    ...baseCreateInput(owner.id, category.id),
    propertyType: "shop",
  });

  await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    propertyType: "house",
    // A caller (buggy client, or a resurfaced stale form value) still sends
    // shop fields in the same request that changes the type away from
    // shop -- these must be nulled regardless, not just left uncleared.
    isCornerShop: true,
    suitableFor: ["retail"],
  });

  const stored = container.repos.propertyRepo.properties.get(created.id);
  assert.equal(stored?.propertyType, "house");
  assert.equal(stored?.isCornerShop, null);
  assert.equal(stored?.suitableFor, null);
});

test("UpdatePropertyUseCase: leaves shop fields untouched on an unrelated edit that keeps propertyType as shop", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);

  const created = await container.createProperty.execute({
    ...baseCreateInput(owner.id, category.id),
    propertyType: "shop",
    isCornerShop: true,
    suitableFor: ["retail"],
  });

  const updated = await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
    rentAmount: 45000,
  });

  assert.equal(updated.rentAmount, 45000);
  const stored = container.repos.propertyRepo.properties.get(created.id);
  assert.equal(stored?.propertyType, "shop");
  assert.equal(stored?.isCornerShop, true);
  assert.deepEqual(stored?.suitableFor, ["retail"]);
});

test("UpdatePropertyUseCase: a stranger cannot update someone else's property", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
  const stranger = await container.repos.userRepo.create({ name: "Rahul", email: "rahul@example.com" });

  await assert.rejects(
    () =>
      container.updateProperty.execute({
        propertyId: created.id,
        requesterId: stranger.id,
        requesterRoles: ["customer"],
        rentAmount: 99999,
      }),
    ForbiddenError,
  );
});

test("UpdatePropertyUseCase: an admin can update a property they do not own", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));
  const admin = await container.repos.userRepo.create({ name: "Admin", email: "admin@example.com" });

  const updated = await container.updateProperty.execute({
    propertyId: created.id,
    requesterId: admin.id,
    requesterRoles: ["admin"],
    rentAmount: 42000,
  });
  assert.equal(updated.rentAmount, 42000);
});

test("DeletePropertyUseCase: soft-deletes and records a 'removed' status history entry", async () => {
  const container = buildPropertyTestContainer();
  const { owner, category } = await setupOwnerAndCategory(container);
  const created = await container.createProperty.execute(baseCreateInput(owner.id, category.id));

  await container.deleteProperty.execute({
    propertyId: created.id,
    requesterId: owner.id,
    requesterRoles: ["property_owner"],
  });

  const stored = container.repos.propertyRepo.properties.get(created.id);
  assert.ok(stored?.deletedAt);

  await assert.rejects(
    () =>
      container.deleteProperty.execute({
        propertyId: created.id,
        requesterId: owner.id,
        requesterRoles: ["property_owner"],
      }),
    NotFoundError,
    "deleting an already-deleted property should 404",
  );

  const history = container.repos.statusHistoryRepo.entries;
  assert.equal(history[history.length - 1].newStatus, "removed");
});

// Phase 3 Part 2, Part 3: updatePropertySchema must require Floor + PIN
// when a request converts an existing property to "shop" -- mirrors
// createPropertySchema's existing superRefine. Scoped to requests that
// explicitly set propertyType: "shop" in their own payload (see the
// doc-comment on updatePropertySchema in property.schemas.ts for why: the
// schema has no access to the existing DB row, so it cannot safely
// enforce this for a patch that omits propertyType entirely).

function baseUpdatePayload(overrides: Record<string, unknown> = {}) {
  return {
    rentAmount: 42000,
    ...overrides,
  };
}

test("updatePropertySchema: converting to shop without floorNumber or PIN code fails validation", () => {
  const result = updatePropertySchema.safeParse(
    baseUpdatePayload({
      propertyType: "shop",
      location: { addressLine: "221B Baner Road", city: "Pune" },
    }),
  );

  assert.equal(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    assert.ok(paths.includes("floorNumber"), "expected a floorNumber issue");
    assert.ok(paths.includes("location.postalCode"), "expected a location.postalCode issue");
  }
});

test("updatePropertySchema: converting to shop with valid floorNumber and PIN code passes validation", () => {
  const result = updatePropertySchema.safeParse(
    baseUpdatePayload({
      propertyType: "shop",
      floorNumber: 1,
      location: { addressLine: "221B Baner Road", city: "Pune", postalCode: "411045" },
    }),
  );

  assert.equal(result.success, true);
});

test("updatePropertySchema: an unrelated partial edit that omits propertyType is never blocked by the shop requirement", () => {
  // Simulates a partial edit to a property that may already be "shop" in
  // the database -- propertyType is not resent, so the schema (which
  // cannot see the existing row) must not attempt to enforce floor/PIN
  // here. This is the exact "legitimate partial update must not
  // incorrectly fail" case called out for this validator.
  const result = updatePropertySchema.safeParse(baseUpdatePayload({ rentAmount: 50000 }));
  assert.equal(result.success, true);
});

test("updatePropertySchema: converting away from shop introduces no new requirement", () => {
  const result = updatePropertySchema.safeParse(
    baseUpdatePayload({ propertyType: "apartment" }),
  );
  assert.equal(result.success, true);
});

test("updatePropertySchema: converting to shop does not require any of the other shop-only fields", () => {
  const result = updatePropertySchema.safeParse(
    baseUpdatePayload({
      propertyType: "shop",
      floorNumber: 2,
      location: { addressLine: "221B Baner Road", city: "Pune", postalCode: "411045" },
      // frontWidthFt, shopDepthFt, roadWidthFt, powerLoad, isCornerShop,
      // hasWashroom, readyToMove, suitableFor are all intentionally
      // omitted here.
    }),
  );
  assert.equal(result.success, true);
});
