"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const buildPropertySearchQuery_1 = require("@/infrastructure/database/buildPropertySearchQuery");
function baseOptions(overrides = {}) {
    return {
        filters: {},
        sort: "newest",
        page: 1,
        pageSize: 20,
        ...overrides,
    };
}
(0, node_test_1.test)("buildPropertySearchQuery: no filters -- base conditions + pagination only", () => {
    const { itemsQuery, itemsValues, countQuery, countValues } = (0, buildPropertySearchQuery_1.buildPropertySearchQuery)(baseOptions());
    strict_1.default.match(itemsQuery, /p\.deleted_at IS NULL/);
    strict_1.default.match(itemsQuery, /p\.status = 'published'/);
    // ORDER BY applies to the outer `SELECT * FROM (...) sub` wrapper (added
    // for radius-search distance filtering), so it correctly references the
    // unqualified/sub-scoped column name here, not `p.` -- there is no `p`
    // alias in scope outside the subquery.
    strict_1.default.match(itemsQuery, /ORDER BY created_at DESC/);
    strict_1.default.match(itemsQuery, /LIMIT \$1 OFFSET \$2/);
    strict_1.default.deepEqual(itemsValues, [20, 0]);
    strict_1.default.match(countQuery, /p\.deleted_at IS NULL/);
    strict_1.default.doesNotMatch(countQuery, /LIMIT/);
    strict_1.default.deepEqual(countValues, []);
});
(0, node_test_1.test)("buildPropertySearchQuery: page 3 computes the correct offset", () => {
    const { itemsValues } = (0, buildPropertySearchQuery_1.buildPropertySearchQuery)(baseOptions({ page: 3, pageSize: 10 }));
    // offset = (3-1)*10 = 20
    strict_1.default.deepEqual(itemsValues, [10, 20]);
});
(0, node_test_1.test)("buildPropertySearchQuery: each sort option maps to the right ORDER BY clause", () => {
    // Same as above: ORDER BY sits outside the `sub` subquery wrapper, so
    // these are unqualified column names, not `p.`-prefixed.
    const cases = [
        ["newest", /ORDER BY created_at DESC/],
        ["most_viewed", /ORDER BY view_count DESC/],
        ["price_low_to_high", /ORDER BY rent_amount ASC/],
        ["price_high_to_low", /ORDER BY rent_amount DESC/],
    ];
    for (const [sort, pattern] of cases) {
        const { itemsQuery } = (0, buildPropertySearchQuery_1.buildPropertySearchQuery)(baseOptions({ sort }));
        strict_1.default.match(itemsQuery, pattern, `sort=${sort}`);
    }
});
(0, node_test_1.test)("buildPropertySearchQuery: simple filters produce correctly indexed params", () => {
    const { itemsQuery, itemsValues, countQuery, countValues } = (0, buildPropertySearchQuery_1.buildPropertySearchQuery)(baseOptions({
        filters: { city: "Mumbai", bedroomsMin: 2 },
    }));
    strict_1.default.match(itemsQuery, /p\.bedrooms >= \$1/);
    strict_1.default.match(itemsQuery, /pl\.city ILIKE \$2/);
    strict_1.default.match(itemsQuery, /LIMIT \$3 OFFSET \$4/);
    strict_1.default.deepEqual(itemsValues, [2, "%Mumbai%", 20, 0]);
    strict_1.default.match(countQuery, /p\.bedrooms >= \$1/);
    strict_1.default.match(countQuery, /pl\.city ILIKE \$2/);
    strict_1.default.deepEqual(countValues, [2, "%Mumbai%"]);
});
(0, node_test_1.test)("buildPropertySearchQuery: complex filter combo + radius search indexes params correctly", () => {
    const { itemsQuery, itemsValues, countQuery, countValues } = (0, buildPropertySearchQuery_1.buildPropertySearchQuery)(baseOptions({
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
    }));
    // 4 scalar filters ($1-$4: rentMin, rentMax, bedroomsMin, city) + lat
    // BETWEEN ($5,$6) + lng BETWEEN ($7,$8) + lat/lng/radius for the distance
    // calc ($9,$10,$11) + limit/offset ($12,$13) = 13 params for the items query.
    strict_1.default.equal(itemsValues.length, 13);
    strict_1.default.match(itemsQuery, /p\.rent_amount >= \$1/);
    strict_1.default.match(itemsQuery, /p\.rent_amount <= \$2/);
    strict_1.default.match(itemsQuery, /p\.bedrooms >= \$3/);
    strict_1.default.match(itemsQuery, /pl\.city ILIKE \$4/);
    strict_1.default.match(itemsQuery, /pl\.latitude BETWEEN \$5 AND \$6/);
    strict_1.default.match(itemsQuery, /pl\.longitude BETWEEN \$7 AND \$8/);
    strict_1.default.match(itemsQuery, /distance_km <= \$11/);
    strict_1.default.match(itemsQuery, /LIMIT \$12 OFFSET \$13/);
    strict_1.default.match(itemsQuery, /ORDER BY rent_amount ASC/);
    // offset = (2-1)*25 = 25
    strict_1.default.equal(itemsValues[itemsValues.length - 2], 25);
    strict_1.default.equal(itemsValues[itemsValues.length - 1], 25);
    // Count query has the same filter params but no limit/offset -- 11 values.
    strict_1.default.equal(countValues.length, 11);
    strict_1.default.doesNotMatch(countQuery, /LIMIT/);
    strict_1.default.match(countQuery, /distance_km <= \$11/);
});
(0, node_test_1.test)("buildPropertySearchQuery: radius search omitted when only some of lat/lng/radius given", () => {
    const { itemsQuery, itemsValues } = (0, buildPropertySearchQuery_1.buildPropertySearchQuery)(baseOptions({ filters: { latitude: 19.0, longitude: 72.8 } }));
    // distance_km is always selected (as a static NULL default) but the
    // bounding-box/exact-Haversine calculation only kicks in once radiusKm
    // is also provided.
    strict_1.default.match(itemsQuery, /NULL::numeric AS distance_km/);
    strict_1.default.doesNotMatch(itemsQuery, /acos/);
    strict_1.default.doesNotMatch(itemsQuery, /BETWEEN/);
    strict_1.default.deepEqual(itemsValues, [20, 0]);
});
