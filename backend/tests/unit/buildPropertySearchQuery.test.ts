import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPropertySearchQuery } from "@/infrastructure/database/buildPropertySearchQuery";
import { PropertySearchOptions } from "@/domain/repositories/IPropertyRepository";

function baseOptions(overrides: Partial<PropertySearchOptions> = {}): PropertySearchOptions {
  return {
    filters: {},
    sort: "newest",
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

test("buildPropertySearchQuery: no filters -- base conditions + pagination only", () => {
  const { itemsQuery, itemsValues, countQuery, countValues } = buildPropertySearchQuery(baseOptions());

  assert.match(itemsQuery, /p\.deleted_at IS NULL/);
  assert.match(itemsQuery, /p\.status = 'published'/);
  // ORDER BY applies to the outer `SELECT * FROM (...) sub` wrapper (added
  // for radius-search distance filtering), so it correctly references the
  // unqualified/sub-scoped column name here, not `p.` -- there is no `p`
  // alias in scope outside the subquery.
  assert.match(itemsQuery, /ORDER BY created_at DESC/);
  assert.match(itemsQuery, /LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(itemsValues, [20, 0]);

  assert.match(countQuery, /p\.deleted_at IS NULL/);
  assert.doesNotMatch(countQuery, /LIMIT/);
  assert.deepEqual(countValues, []);
});

test("buildPropertySearchQuery: page 3 computes the correct offset", () => {
  const { itemsValues } = buildPropertySearchQuery(baseOptions({ page: 3, pageSize: 10 }));
  // offset = (3-1)*10 = 20
  assert.deepEqual(itemsValues, [10, 20]);
});

test("buildPropertySearchQuery: each sort option maps to the right ORDER BY clause", () => {
  // Same as above: ORDER BY sits outside the `sub` subquery wrapper, so
  // these are unqualified column names, not `p.`-prefixed.
  const cases: Array<[PropertySearchOptions["sort"], RegExp]> = [
    ["newest", /ORDER BY created_at DESC/],
    ["most_viewed", /ORDER BY view_count DESC/],
    ["price_low_to_high", /ORDER BY rent_amount ASC/],
    ["price_high_to_low", /ORDER BY rent_amount DESC/],
  ];
  for (const [sort, pattern] of cases) {
    const { itemsQuery } = buildPropertySearchQuery(baseOptions({ sort }));
    assert.match(itemsQuery, pattern, `sort=${sort}`);
  }
});

test("buildPropertySearchQuery: simple filters produce correctly indexed params", () => {
  const { itemsQuery, itemsValues, countQuery, countValues } = buildPropertySearchQuery(
    baseOptions({
      filters: { city: "Mumbai", bedroomsMin: 2 },
    }),
  );

  assert.match(itemsQuery, /p\.bedrooms >= \$1/);
  assert.match(itemsQuery, /pl\.city ILIKE \$2/);
  assert.match(itemsQuery, /LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(itemsValues, [2, "%Mumbai%", 20, 0]);

  assert.match(countQuery, /p\.bedrooms >= \$1/);
  assert.match(countQuery, /pl\.city ILIKE \$2/);
  assert.deepEqual(countValues, [2, "%Mumbai%"]);
});

test("buildPropertySearchQuery: complex filter combo + radius search indexes params correctly", () => {
  const { itemsQuery, itemsValues, countQuery, countValues } = buildPropertySearchQuery(
    baseOptions({
      filters: {
        city: "Pune",
        bedroomsMin: 2,
        rentMin: 10000,
        rentMax: 50000,
        latitude: 18.5204,
        longitude: 73.8567,
        radiusKm: 15,
      },
      sort: "price_low_to_high",
      page: 2,
      pageSize: 25,
    }),
  );

  // 4 scalar filters ($1-$4: rentMin, rentMax, bedroomsMin, city) + lat
  // BETWEEN ($5,$6) + lng BETWEEN ($7,$8) + lat/lng/radius for the distance
  // calc ($9,$10,$11) + limit/offset ($12,$13) = 13 params for the items query.
  assert.equal(itemsValues.length, 13);
  assert.match(itemsQuery, /p\.rent_amount >= \$1/);
  assert.match(itemsQuery, /p\.rent_amount <= \$2/);
  assert.match(itemsQuery, /p\.bedrooms >= \$3/);
  assert.match(itemsQuery, /pl\.city ILIKE \$4/);
  assert.match(itemsQuery, /pl\.latitude BETWEEN \$5 AND \$6/);
  assert.match(itemsQuery, /pl\.longitude BETWEEN \$7 AND \$8/);
  assert.match(itemsQuery, /distance_km <= \$11/);
  assert.match(itemsQuery, /LIMIT \$12 OFFSET \$13/);
  assert.match(itemsQuery, /ORDER BY rent_amount ASC/);

  // offset = (2-1)*25 = 25
  assert.equal(itemsValues[itemsValues.length - 2], 25);
  assert.equal(itemsValues[itemsValues.length - 1], 25);

  // Count query has the same filter params but no limit/offset -- 11 values.
  assert.equal(countValues.length, 11);
  assert.doesNotMatch(countQuery, /LIMIT/);
  assert.match(countQuery, /distance_km <= \$11/);
});

test("buildPropertySearchQuery: radius search omitted when only some of lat/lng/radius given", () => {
  const { itemsQuery, itemsValues } = buildPropertySearchQuery(
    baseOptions({ filters: { latitude: 19.0, longitude: 72.8 } }),
  );
  // distance_km is always selected (as a static NULL default) but the
  // bounding-box/exact-Haversine calculation only kicks in once radiusKm
  // is also provided.
  assert.match(itemsQuery, /NULL::numeric AS distance_km/);
  assert.doesNotMatch(itemsQuery, /acos/);
  assert.doesNotMatch(itemsQuery, /BETWEEN/);
  assert.deepEqual(itemsValues, [20, 0]);
});
