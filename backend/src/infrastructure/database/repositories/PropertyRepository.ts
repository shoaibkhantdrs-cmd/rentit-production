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
  available_from: string;
  view_count: number;
  favorite_count: number;
  published_at: Date | null;
  is_featured: boolean;
  moderated_by: string | null;
  moderated_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  distance_km?: string;
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
    availableFrom: typeof row.available_from === "string" ? row.available_from.slice(0, 10) : row.available_from,
    viewCount: row.view_count,
    favoriteCount: row.favorite_count,
    publishedAt: row.published_at,
    isFeatured: row.is_featured,
    moderatedBy: row.moderated_by,
    moderatedAt: row.moderated_at,
    rejectionReason: row.rejection_reason,
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
         floor_number, total_floors, facing, furnished_status, available_from
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
