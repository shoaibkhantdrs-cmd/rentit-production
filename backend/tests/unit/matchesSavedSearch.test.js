"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const matchesSavedSearch_1 = require("@/application/properties/shared/matchesSavedSearch");
function makeProperty(overrides = {}) {
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
function makeLocation(overrides = {}) {
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
(0, node_test_1.test)("matchesSavedSearch: an empty filter set matches everything", () => {
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), makeLocation(), {}), true);
});
(0, node_test_1.test)("matchesSavedSearch: categoryId must match exactly", () => {
    const filters = { categoryId: "cat-villas" };
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), makeLocation(), filters), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty({ categoryId: "cat-villas" }), makeLocation(), filters), true);
});
(0, node_test_1.test)("matchesSavedSearch: rent range is inclusive on both ends", () => {
    const property = makeProperty({ rentAmount: 20000 });
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { rentMin: 20000, rentMax: 20000 }), true);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { rentMin: 20001 }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { rentMax: 19999 }), false);
});
(0, node_test_1.test)("matchesSavedSearch: bedroomsMin/bathroomsMin/parkingMin/area are floor filters", () => {
    const property = makeProperty({ bedrooms: 2, bathrooms: 1, parkingSpaces: 1, areaSqft: 900 });
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { bedroomsMin: 3 }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { bedroomsMin: 2 }), true);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { bathroomsMin: 2 }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { parkingMin: 2 }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { areaMin: 1000 }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { areaMax: 800 }), false);
});
(0, node_test_1.test)("matchesSavedSearch: city/locality comparisons are case-insensitive", () => {
    const location = makeLocation({ city: "Bengaluru", locality: "Indiranagar" });
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), location, { city: "bengaluru" }), true);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), location, { city: "Mumbai" }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), location, { locality: "INDIRANAGAR" }), true);
});
(0, node_test_1.test)("matchesSavedSearch: without a location, city/locality/radius filters never match", () => {
    const filters = { city: "Bengaluru" };
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), null, filters), false);
});
(0, node_test_1.test)("matchesSavedSearch: radius filter uses real distance, not just a bounding box", () => {
    // Roughly 1km from the seed location.
    const nearby = makeLocation({ latitude: 12.98, longitude: 77.6412 });
    const farAway = makeLocation({ latitude: 13.5, longitude: 78.5 });
    const filters = { latitude: 12.9716, longitude: 77.6412, radiusKm: 5 };
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), nearby, filters), true);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(makeProperty(), farAway, filters), false);
});
(0, node_test_1.test)("matchesSavedSearch: availableFrom filter matches properties available on or before that date", () => {
    const property = makeProperty({ availableFrom: "2026-09-01" });
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { availableFrom: "2026-08-01" }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { availableFrom: "2026-09-01" }), true);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { availableFrom: "2026-10-01" }), true);
});
(0, node_test_1.test)("matchesSavedSearch: furnished status must match exactly when specified", () => {
    const property = makeProperty({ furnishedStatus: "fully_furnished" });
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { furnished: "unfurnished" }), false);
    strict_1.default.equal((0, matchesSavedSearch_1.matchesSavedSearch)(property, makeLocation(), { furnished: "fully_furnished" }), true);
});
