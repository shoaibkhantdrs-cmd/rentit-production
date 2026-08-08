import { Pool } from "pg";
import {
  AdminPropertySearchOptions,
  AdminPropertySearchResult,
  IPropertyRepository,
  PropertySearchOptions,
  PropertySearchResult,
} from "@/domain/repositories/IPropertyRepository";
import { NewProperty, Property, PropertyUpdatePatch } from "@/domain/entities/Property";
import { buildPropertySearchQuery } from "@/infrastructure/database/buildPropertySearchQuery";
import { buildAdminPropertySearchQuery } from "@/infrastructure/database/buildAdminPropertySearchQuery";

interface PropertyRow {
  id: string;
  owner_id: string;
  category_id: string;
  title: string;
  description: string;
  property_type: Property["propertyType"];
  status: Property["status"];
  rent_amount: string;
  security_deposit: string;
  area_sqft: string;
  bedrooms: number;
  bathrooms: number;
  parking_spaces: number;
  floor_number: number | null;
  total_floors: number | null;
  facing: Property["facing"];
  furnished_status: Property["furnishedStatus"];
  // node-postgres returns a Postgres DATE column as a JS Date object by
  // default (not a string) -- this type previously claimed `string`,
  // which masked the bug fixed by formatDateOnly() below. Kept as the
  // union it actually is at runtime.
  available_from: string | Date;
  view_count: number;
  favorite_count: number;
  published_at: Date | null;
  is_featured: boolean;
  moderated_by: string | null;
  moderated_at: Date | null;
  rejection_reason: string | null;
  // Phase 2 Part 2 (Shop Listing UI).
  front_width_ft: string | null;
  shop_depth_ft: string | null;
  road_width_ft: string | null;
  power_load: string | null;
  is_corner_shop: boolean | null;
  has_washroom: boolean | null;
  ready_to_move: boolean | null;
  suitable_for: string[] | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  distance_km?: string;
}

/**
 * Phase 3 Part 2: normalizes a Postgres DATE value to YYYY-MM-DD.
 *
 * Root cause: node-postgres returns a DATE column as a JS Date object by
 * default (not a string). The previous `typeof row.available_from ===
 * "string"` check in toEntity() therefore never matched in production --
 * the raw Date object fell through to the `: row.available_from` branch
 * unnormalized. That Date object then serialized via JSON.stringify's
 * implicit toISOString() call into a full ISO datetime string (e.g.
 * "2026-08-10T00:00:00.000Z") in the HTTP response. Native
 * `<input type="date">` elements require an exact YYYY-MM-DD value and
 * silently reject anything else, leaving Edit Property's Available From
 * field empty and blocking Save via the `required` attribute with zero
 * network request -- confirmed live in production prior to this fix.
 *
 * Timezone fix (found in code review, before this ever shipped): the
 * `postgres-date` package (node-postgres's DATE parser) builds that Date
 * object with the *local-time* multi-arg constructor --
 * `new Date(year, month, day)` -- not a UTC-anchored one. Reading it back
 * out with `.toISOString()` converts to UTC, which in any positive
 * UTC-offset timezone (e.g. Asia/Kolkata, IST = UTC+5:30) rolls the
 * calendar date back by one day: local midnight on the 10th is 18:30 UTC
 * on the 9th. Using the Date object's own local getters instead
 * (getFullYear/getMonth/getDate) is the symmetric inverse of how the
 * value was constructed, so it's correct regardless of server timezone.
 *
 * Handles a Date, an already-correct "YYYY-MM-DD" string, a longer ISO
 * datetime string (defensive, in case a driver/config change ever returns
 * dates as full ISO strings instead of Date objects), and null/undefined.
 * Does not change the database column type.
 */
export function formatDateOnly(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

function toEntity(row: PropertyRow): Property {
  return {
    id: row.id,
    ownerId: row.owner_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    propertyType: row.property_type,
    status: row.status,
    rentAmount: parseFloat(row.rent_amount),
    securityDeposit: parseFloat(row.security_deposit),
    areaSqft: parseFloat(row.area_sqft),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parkingSpaces: row.parking_spaces,
    floorNumber: row.floor_number,
    totalFloors: row.total_floors,
    facing: row.facing,
    furnishedStatus: row.furnished_status,
    availableFrom: formatDateOnly(row.available_from),
    viewCount: row.view_count,
    favoriteCount: row.favorite_count,
    publishedAt: row.published_at,
    isFeatured: row.is_featured,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    rejectionReason: row.rejection_reason,
    frontWidthFt: row.front_width_ft !== null ? parseFloat(row.front_width_ft) : null,
    shopDepthFt: row.shop_depth_ft !== null ? parseFloat(row.shop_depth_ft) : null,
    roadWidthFt: row.road_width_ft !== null ? parseFloat(row.road_width_ft) : null,
    powerLoad: row.power_load,
    isCornerShop: row.is_corner_shop,
    hasWashroom: row.has_washroom,
    readyToMove: row.ready_to_move,
    suitableFor: row.suitable_for,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class PropertyRepository implements IPropertyRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: NewProperty): Promise<Property> {
    const result = await this.pool.query<PropertyRow>(
      `INSERT INTO properties (
         owner_id, category_id, title, description, property_type, rent_amount,
         security_deposit, area_sqft, bedrooms, bathrooms, parking_spaces,
         floor_number, total_floors, facing, furnished_status, available_from,
         front_width_ft, shop_depth_ft, road_width_ft, power_load,
         is_corner_shop, has_washroom, ready_to_move, suitable_for
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        data.ownerId,
        data.categoryId,
        data.title,
        data.description,
        data.propertyType,
        data.rentAmount,
        data.securityDeposit,
        data.areaSqft,
        data.bedrooms,
        data.bathrooms,
        data.parkingSpaces,
        data.floorNumber ?? null,
        data.totalFloors ?? null,
        data.facing ?? null,
        data.furnishedStatus,
        data.availableFrom,
        data.frontWidthFt ?? null,
        data.shopDepthFt ?? null,
        data.roadWidthFt ?? null,
        data.powerLoad ?? null,
        data.isCornerShop ?? null,
        data.hasWashroom ?? null,
        data.readyToMove ?? null,
        data.suitableFor ?? null,
      ],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<Property | null> {
    const result = await this.pool.query<PropertyRow>("SELECT * FROM properties WHERE id = $1", [id]);
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async update(id: string, patch: PropertyUpdatePatch): Promise<Property> {
    const columnMap: Record<string, unknown> = {
      title: patch.title,
      description: patch.description,
      category_id: patch.categoryId,
      property_type: patch.propertyType,
      rent_amount: patch.rentAmount,
      security_deposit: patch.securityDeposit,
      area_sqft: patch.areaSqft,
      bedrooms: patch.bedrooms,
      bathrooms: patch.bathrooms,
      parking_spaces: patch.parkingSpaces,
      floor_number: patch.floorNumber,
      total_floors: patch.totalFloors,
      facing: patch.facing,
      furnished_status: patch.furnishedStatus,
      available_from: patch.availableFrom,
      status: patch.status,
      view_count: patch.viewCount,
      favorite_count: patch.favoriteCount,
      published_at: patch.publishedAt,
      is_featured: patch.isFeatured,
      moderated_by: patch.moderatedBy,
      moderated_at: patch.moderatedAt,
      rejection_reason: patch.rejectionReason,
      front_width_ft: patch.frontWidthFt,
      shop_depth_ft: patch.shopDepthFt,
      road_width_ft: patch.roadWidthFt,
      power_load: patch.powerLoad,
      is_corner_shop: patch.isCornerShop,
      has_washroom: patch.hasWashroom,
      ready_to_move: patch.readyToMove,
      suitable_for: patch.suitableFor,
    };

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [column, value] of Object.entries(columnMap)) {
      if (value !== undefined) {
        fields.push(`${column} = $${i}`);
        values.push(value);
        i += 1;
      }
    }

    if (fields.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error(`Property ${id} not found`);
      return existing;
    }

    values.push(id);
    const result = await this.pool.query<PropertyRow>(
      `UPDATE properties SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new Error(`Property ${id} not found`);
    return toEntity(result.rows[0]);
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query("UPDATE properties SET deleted_at = now() WHERE id = $1", [id]);
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.pool.query("UPDATE properties SET view_count = view_count + 1 WHERE id = $1", [id]);
  }

  async adjustFavoriteCount(id: string, delta: 1 | -1): Promise<void> {
    await this.pool.query(
      "UPDATE properties SET favorite_count = GREATEST(0, favorite_count + $2) WHERE id = $1",
      [id, delta],
    );
  }

  async findByOwner(
    ownerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Property[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PropertyRow>(
        `SELECT * FROM properties WHERE owner_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [ownerId, pageSize, offset],
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*) FROM properties WHERE owner_id = $1 AND deleted_at IS NULL",
        [ownerId],
      ),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findManyByIds(ids: string[]): Promise<Property[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query<PropertyRow>(
      "SELECT * FROM properties WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL",
      [ids],
    );
    return result.rows.map(toEntity);
  }

  async search(options: PropertySearchOptions): Promise<PropertySearchResult> {
    const { itemsQuery, itemsValues, countQuery, countValues } = buildPropertySearchQuery(options);

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PropertyRow>(itemsQuery, itemsValues),
      this.pool.query<{ count: string }>(countQuery, countValues),
    ]);

    return {
      items: itemsResult.rows.map((row) => ({
        property: toEntity(row),
        distanceKm:
          row.distance_km !== null && row.distance_km !== undefined
            ? parseFloat(row.distance_km)
            : null,
      })),
      total: parseInt(countResult.rows[0].count, 10),
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  async adminSearch(options: AdminPropertySearchOptions): Promise<AdminPropertySearchResult> {
    const { itemsQuery, itemsValues, countQuery, countValues } = buildAdminPropertySearchQuery(options);

    const [itemsResult, countResult] = await Promise.all([
      this.pool.query<PropertyRow>(itemsQuery, itemsValues),
      this.pool.query<{ count: string }>(countQuery, countValues),
    ]);

    return {
      items: itemsResult.rows.map(toEntity),
      total: parseInt(countResult.rows[0].count, 10),
      page: options.page,
      pageSize: options.pageSize,
    };
  }
}
