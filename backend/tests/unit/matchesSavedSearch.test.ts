import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesSavedSearch } from "@/application/properties/shared/matchesSavedSearch";
import { Property } from "@/domain/entities/Property";
import { PropertyLocation } from "@/domain/entities/PropertyLocation";

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-1",
    ownerId: "owner-1",
    categoryId: "cat-apartments",
    title: "Nice place",
    description: "desc",
    propertyType: "apartment",
    status: "published",
    rentAmount: 20000,
    securityDeposit: 40000,
    areaSqft: 900,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    floorNumber: 3,
    totalFloors: 10,
    facing: "east",
    furnishedStatus: "semi_furnished",
    availableFrom: "2026-08-01",
    viewCount: 0,
    favoriteCount: 0,
    publishedAt: new Date(),
    isFeatured: false,
    moderatedBy: null,
    moderatedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function makeLocation(overrides: Partial<PropertyLocation> = {}): PropertyLocation {
  return {
    id: "loc-1",
    propertyId: "prop-1",
    addressLine: "123 Main St",
    city: "Bengaluru",
    locality: "Indiranagar",
    state: "KA",
    country: "IN",
    postalCode: "560038",
    latitude: 12.9716,
    longitude: 77.6412,
    formattedAddress: null,
    placeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("matchesSavedSearch: an empty filter set matches everything", () => {
  assert.equal(matchesSavedSearch(makeProperty(), makeLocation(), {}), true);
});

test("matchesSavedSearch: categoryId must match exactly", () => {
  const filters = { categoryId: "cat-villas" };
  assert.equal(matchesSavedSearch(makeProperty(), makeLocation(), filters), false);
  assert.equal(
    matchesSavedSearch(makeProperty({ categoryId: "cat-villas" }), makeLocation(), filters),
    true,
  );
});

test("matchesSavedSearch: rent range is inclusive on both ends", () => {
  const property = makeProperty({ rentAmount: 20000 });
  assert.equal(matchesSavedSearch(property, makeLocation(), { rentMin: 20000, rentMax: 20000 }), true);
  assert.equal(matchesSavedSearch(property, makeLocation(), { rentMin: 20001 }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { rentMax: 19999 }), false);
});

test("matchesSavedSearch: bedroomsMin/bathroomsMin/parkingMin/area are floor filters", () => {
  const property = makeProperty({ bedrooms: 2, bathrooms: 1, parkingSpaces: 1, areaSqft: 900 });
  assert.equal(matchesSavedSearch(property, makeLocation(), { bedroomsMin: 3 }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { bedroomsMin: 2 }), true);
  assert.equal(matchesSavedSearch(property, makeLocation(), { bathroomsMin: 2 }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { parkingMin: 2 }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { areaMin: 1000 }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { areaMax: 800 }), false);
});

test("matchesSavedSearch: city/locality comparisons are case-insensitive", () => {
  const location = makeLocation({ city: "Bengaluru", locality: "Indiranagar" });
  assert.equal(matchesSavedSearch(makeProperty(), location, { city: "bengaluru" }), true);
  assert.equal(matchesSavedSearch(makeProperty(), location, { city: "Mumbai" }), false);
  assert.equal(matchesSavedSearch(makeProperty(), location, { locality: "INDIRANAGAR" }), true);
});

test("matchesSavedSearch: without a location, city/locality/radius filters never match", () => {
  const filters = { city: "Bengaluru" };
  assert.equal(matchesSavedSearch(makeProperty(), null, filters), false);
});

test("matchesSavedSearch: radius filter uses real distance, not just a bounding box", () => {
  // Roughly 1km from the seed location.
  const nearby = makeLocation({ latitude: 12.98, longitude: 77.6412 });
  const farAway = makeLocation({ latitude: 13.5, longitude: 78.5 });

  const filters = { latitude: 12.9716, longitude: 77.6412, radiusKm: 5 };
  assert.equal(matchesSavedSearch(makeProperty(), nearby, filters), true);
  assert.equal(matchesSavedSearch(makeProperty(), farAway, filters), false);
});

test("matchesSavedSearch: availableFrom filter matches properties available on or before that date", () => {
  const property = makeProperty({ availableFrom: "2026-09-01" });
  assert.equal(matchesSavedSearch(property, makeLocation(), { availableFrom: "2026-08-01" }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { availableFrom: "2026-09-01" }), true);
  assert.equal(matchesSavedSearch(property, makeLocation(), { availableFrom: "2026-10-01" }), true);
});

test("matchesSavedSearch: furnished status must match exactly when specified", () => {
  const property = makeProperty({ furnishedStatus: "fully_furnished" });
  assert.equal(matchesSavedSearch(property, makeLocation(), { furnished: "unfurnished" }), false);
  assert.equal(matchesSavedSearch(property, makeLocation(), { furnished: "fully_furnished" }), true);
});
