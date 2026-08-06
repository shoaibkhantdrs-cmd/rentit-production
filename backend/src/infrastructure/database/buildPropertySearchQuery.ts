import { PropertySearchOptions } from "@/domain/repositories/IPropertyRepository";
import { boundingBox } from "@/application/properties/shared/haversine";

const SORT_CLAUSES: Record<PropertySearchOptions["sort"], string> = {
  newest: "created_at DESC",
  most_viewed: "view_count DESC",
  price_low_to_high: "rent_amount ASC",
  price_high_to_low: "rent_amount DESC",
};

export interface BuiltQuery {
  itemsQuery: string;
  itemsValues: unknown[];
  countQuery: string;
  countValues: unknown[];
}

/**
 * Pure function: turns search filters into parameterized SQL + bound
 * values, with no database dependency. Extracted out of PropertyRepository
 * specifically so this -- the trickiest part of Phase 3's backend
 * (conditional clauses, positional param indexing, the bounding-box +
 * exact-Haversine radius search) -- can be unit-tested without a live
 * Postgres connection.
 */
export function buildPropertySearchQuery(options: PropertySearchOptions): BuiltQuery {
  const { filters } = options;
  const conditions: string[] = ["p.deleted_at IS NULL", "p.status = 'published'"];
  const values: unknown[] = [];
  let paramIndex = 1;

  const push = (condition: string, value: unknown) => {
    conditions.push(condition.replace("?", `$${paramIndex}`));
    values.push(value);
    paramIndex += 1;
  };

  if (filters.categoryId) push("p.category_id = ?", filters.categoryId);
  if (filters.propertyType) push("p.property_type = ?", filters.propertyType);
  if (filters.rentMin !== undefined) push("p.rent_amount >= ?", filters.rentMin);
  if (filters.rentMax !== undefined) push("p.rent_amount <= ?", filters.rentMax);
  if (filters.bedroomsMin !== undefined) push("p.bedrooms >= ?", filters.bedroomsMin);
  if (filters.bathroomsMin !== undefined) push("p.bathrooms >= ?", filters.bathroomsMin);
  if (filters.parkingMin !== undefined) push("p.parking_spaces >= ?", filters.parkingMin);
  if (filters.areaMin !== undefined) push("p.area_sqft >= ?", filters.areaMin);
  if (filters.areaMax !== undefined) push("p.area_sqft <= ?", filters.areaMax);
  if (filters.furnished) push("p.furnished_status = ?", filters.furnished);
  if (filters.availableFrom) push("p.available_from <= ?", filters.availableFrom);
  if (filters.city) push("pl.city ILIKE ?", `%${filters.city}%`);
  if (filters.locality) push("pl.locality ILIKE ?", `%${filters.locality}%`);

  // Phase 3 Part 1 (Shop Search & Filters). Each column below is NULL for
  // every non-shop row, so these conditions correctly exclude residential
  // listings by construction -- no explicit `propertyType = 'shop'` guard
  // needed (NULL >= x and NULL = true both evaluate to no-match). Absent
  // from a query string (the case for every search today), zero conditions
  // are added and the query is byte-for-byte identical to before this
  // change.
  if (filters.frontWidthMin !== undefined) push("p.front_width_ft >= ?", filters.frontWidthMin);
  if (filters.roadWidthMin !== undefined) push("p.road_width_ft >= ?", filters.roadWidthMin);
  if (filters.readyToMove !== undefined) push("p.ready_to_move = ?", filters.readyToMove);
  if (filters.isCornerShop !== undefined) push("p.is_corner_shop = ?", filters.isCornerShop);
  if (filters.hasWashroom !== undefined) push("p.has_washroom = ?", filters.hasWashroom);
  // suitable_for is a native TEXT[] column -- `&&` is Postgres's
  // array-overlap operator ("matches any of"), the one condition here that
  // isn't a plain scalar comparison. NULL && anything is NULL (falsy), so
  // this also correctly excludes residential rows.
  if (filters.suitableFor !== undefined && filters.suitableFor.length > 0) {
    push("p.suitable_for && ?::text[]", filters.suitableFor);
  }

  let distanceSelect = "NULL::numeric AS distance_km";
  let havingRadius = "";

  if (
    filters.latitude !== undefined &&
    filters.longitude !== undefined &&
    filters.radiusKm !== undefined
  ) {
    const box = boundingBox(filters.latitude, filters.longitude, filters.radiusKm);

    conditions.push(`pl.latitude BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    values.push(box.minLat, box.maxLat);
    paramIndex += 2;

    conditions.push(`pl.longitude BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    values.push(box.minLng, box.maxLng);
    paramIndex += 2;

    const latParam = paramIndex;
    const lngParam = paramIndex + 1;
    const radiusParam = paramIndex + 2;
    values.push(filters.latitude, filters.longitude, filters.radiusKm);
    paramIndex += 3;

    distanceSelect = `(
        6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians($${latParam})) * cos(radians(pl.latitude)) *
              cos(radians(pl.longitude) - radians($${lngParam})) +
            sin(radians($${latParam})) * sin(radians(pl.latitude))
          ))
        )
      ) AS distance_km`;
    havingRadius = `WHERE distance_km <= $${radiusParam}`;
  }

  const whereClause = conditions.join(" AND ");
  const sortClause = SORT_CLAUSES[options.sort];
  const offset = (options.page - 1) * options.pageSize;

  const limitParam = paramIndex;
  const offsetParam = paramIndex + 1;
  const itemsValues = [...values, options.pageSize, offset];

  const baseQuery = `
      SELECT p.*, ${distanceSelect}
      FROM properties p
      JOIN property_locations pl ON pl.property_id = p.id
      WHERE ${whereClause}
    `;

  const itemsQuery = `
      SELECT * FROM (${baseQuery}) sub
      ${havingRadius}
      ORDER BY ${sortClause}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

  const countQuery = `
      SELECT COUNT(*) FROM (${baseQuery}) sub
      ${havingRadius}
    `;

  return { itemsQuery, itemsValues, countQuery, countValues: values };
}
