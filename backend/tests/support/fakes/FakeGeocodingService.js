"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeGeocodingService = void 0;
/** Stands in for Google's Geocoding API with deterministic, offline coordinates. */
class FakeGeocodingService {
    calls = [];
    /** Override per-test to simulate a specific city's coordinates. */
    nextResult = {
        latitude: 19.076,
        longitude: 72.8777,
        formattedAddress: "Fake Formatted Address, Mumbai, India",
        placeId: "fake-place-id",
    };
    async geocode(addressLine, city, locality) {
        this.calls.push({ addressLine, city, locality });
        return this.nextResult;
    }
}
exports.FakeGeocodingService = FakeGeocodingService;
