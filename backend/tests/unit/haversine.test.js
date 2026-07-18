"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const haversine_1 = require("@/application/properties/shared/haversine");
(0, node_test_1.test)("haversineDistanceKm: same point is zero distance", () => {
    const d = (0, haversine_1.haversineDistanceKm)(19.076, 72.8777, 19.076, 72.8777);
    strict_1.default.equal(d, 0);
});
(0, node_test_1.test)("haversineDistanceKm: New York to Los Angeles is ~3936km", () => {
    const d = (0, haversine_1.haversineDistanceKm)(40.7128, -74.006, 34.0522, -118.2437);
    strict_1.default.ok(d > 3900 && d < 3970, `expected ~3936km, got ${d}`);
});
(0, node_test_1.test)("haversineDistanceKm: London to Paris is ~344km", () => {
    const d = (0, haversine_1.haversineDistanceKm)(51.5074, -0.1278, 48.8566, 2.3522);
    strict_1.default.ok(d > 330 && d < 360, `expected ~344km, got ${d}`);
});
(0, node_test_1.test)("haversineDistanceKm: is symmetric", () => {
    const a = (0, haversine_1.haversineDistanceKm)(19.076, 72.8777, 28.6139, 77.209);
    const b = (0, haversine_1.haversineDistanceKm)(28.6139, 77.209, 19.076, 72.8777);
    strict_1.default.ok(Math.abs(a - b) < 1e-9);
});
(0, node_test_1.test)("boundingBox: contains the center point with margin", () => {
    const box = (0, haversine_1.boundingBox)(19.076, 72.8777, 10);
    strict_1.default.ok(box.minLat < 19.076 && box.maxLat > 19.076);
    strict_1.default.ok(box.minLng < 72.8777 && box.maxLng > 72.8777);
});
(0, node_test_1.test)("boundingBox: larger radius produces a wider box", () => {
    const small = (0, haversine_1.boundingBox)(19.076, 72.8777, 5);
    const large = (0, haversine_1.boundingBox)(19.076, 72.8777, 50);
    strict_1.default.ok(large.maxLat - large.minLat > small.maxLat - small.minLat);
    strict_1.default.ok(large.maxLng - large.minLng > small.maxLng - small.minLng);
});
(0, node_test_1.test)("boundingBox: a point within the radius falls inside the box", () => {
    const center = { lat: 19.076, lng: 72.8777 };
    const radiusKm = 20;
    const box = (0, haversine_1.boundingBox)(center.lat, center.lng, radiusKm);
    // A point ~10km north of the center.
    const nearbyLat = center.lat + 10 / 111.32;
    strict_1.default.ok(nearbyLat >= box.minLat && nearbyLat <= box.maxLat);
    const distance = (0, haversine_1.haversineDistanceKm)(center.lat, center.lng, nearbyLat, center.lng);
    strict_1.default.ok(distance <= radiusKm);
});
