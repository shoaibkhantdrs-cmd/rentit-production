import { test } from "node:test";
import assert from "node:assert/strict";
import { boundingBox, haversineDistanceKm } from "@/application/properties/shared/haversine";

test("haversineDistanceKm: same point is zero distance", () => {
  const d = haversineDistanceKm(19.076, 72.8777, 19.076, 72.8777);
  assert.equal(d, 0);
});

test("haversineDistanceKm: New York to Los Angeles is ~3936km", () => {
  const d = haversineDistanceKm(40.7128, -74.006, 34.0522, -118.2437);
  assert.ok(d > 3900 && d < 3970, `expected ~3936km, got ${d}`);
});

test("haversineDistanceKm: London to Paris is ~344km", () => {
  const d = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
  assert.ok(d > 330 && d < 360, `expected ~344km, got ${d}`);
});

test("haversineDistanceKm: is symmetric", () => {
  const a = haversineDistanceKm(19.076, 72.8777, 28.6139, 77.209);
  const b = haversineDistanceKm(28.6139, 77.209, 19.076, 72.8777);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("boundingBox: contains the center point with margin", () => {
  const box = boundingBox(19.076, 72.8777, 10);
  assert.ok(box.minLat < 19.076 && box.maxLat > 19.076);
  assert.ok(box.minLng < 72.8777 && box.maxLng > 72.8777);
});

test("boundingBox: larger radius produces a wider box", () => {
  const small = boundingBox(19.076, 72.8777, 5);
  const large = boundingBox(19.076, 72.8777, 50);
  assert.ok(large.maxLat - large.minLat > small.maxLat - small.minLat);
  assert.ok(large.maxLng - large.minLng > small.maxLng - small.minLng);
});

test("boundingBox: a point within the radius falls inside the box", () => {
  const center = { lat: 19.076, lng: 72.8777 };
  const radiusKm = 20;
  const box = boundingBox(center.lat, center.lng, radiusKm);

  // A point ~10km north of the center.
  const nearbyLat = center.lat + 10 / 111.32;
  assert.ok(nearbyLat >= box.minLat && nearbyLat <= box.maxLat);

  const distance = haversineDistanceKm(center.lat, center.lng, nearbyLat, center.lng);
  assert.ok(distance <= radiusKm);
});
