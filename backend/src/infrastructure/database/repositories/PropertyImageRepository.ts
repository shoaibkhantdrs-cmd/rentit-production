import { Pool } from "pg";
import {
  IPropertyImageRepository,
  NewPropertyImageInput,
} from "@/domain/repositories/IPropertyImageRepository";
import { PropertyImage } from "@/domain/entities/PropertyImage";

interface PropertyImageRow {
  id: string;
  property_id: string;
  cloudinary_public_id: string;
  url: string;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: PropertyImageRow): PropertyImage {
  return {
    id: row.id,
    propertyId: row.property_id,
    cloudinaryPublicId: row.cloudinary_public_id,
    url: row.url,
    width: row.width,
    height: row.height,
    format: row.format,
    bytes: row.bytes,
    isPrimary: row.is_primary,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class PropertyImageRepository implements IPropertyImageRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewPropertyImageInput): Promise<PropertyImage> {
    const result = await this.pool.query<PropertyImageRow>(
      `INSERT INTO property_images (
         property_id, cloudinary_public_id, url, width, height, format, bytes, is_primary, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        input.propertyId,
        input.cloudinaryPublicId,
        input.url,
        input.width,
        input.height,
        input.format,
        input.bytes,
        input.isPrimary,
        input.sortOrder,
      ],
    );
    return toEntity(result.rows[0]);
  }

  async findById(id: string): Promise<PropertyImage | null> {
    const result = await this.pool.query<PropertyImageRow>(
      "SELECT * FROM property_images WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async listForProperty(propertyId: string): Promise<PropertyImage[]> {
    const result = await this.pool.query<PropertyImageRow>(
      "SELECT * FROM property_images WHERE property_id = $1 AND deleted_at IS NULL ORDER BY sort_order",
      [propertyId],
    );
    return result.rows.map(toEntity);
  }

  async listForProperties(propertyIds: string[]): Promise<PropertyImage[]> {
    if (propertyIds.length === 0) return [];
    const result = await this.pool.query<PropertyImageRow>(
      `SELECT * FROM property_images
       WHERE property_id = ANY($1::uuid[]) AND deleted_at IS NULL
       ORDER BY property_id, sort_order`,
      [propertyIds],
    );
    return result.rows.map(toEntity);
  }

  async listPrimaryForProperties(propertyIds: string[]): Promise<PropertyImage[]> {
    if (propertyIds.length === 0) return [];
    // One row per property: the primary image if set, otherwise whatever
    // has the lowest sort_order.
    const result = await this.pool.query<PropertyImageRow>(
      `SELECT DISTINCT ON (property_id) *
       FROM property_images
       WHERE property_id = ANY($1::uuid[]) AND deleted_at IS NULL
       ORDER BY property_id, is_primary DESC, sort_order ASC`,
      [propertyIds],
    );
    return result.rows.map(toEntity);
  }

  async countForProperty(propertyId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM property_images WHERE property_id = $1 AND deleted_at IS NULL",
      [propertyId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async softDelete(id: string): Promise<void> {
    await this.pool.query(
      "UPDATE property_images SET deleted_at = now(), is_primary = false WHERE id = $1",
      [id],
    );
  }

  async setPrimary(propertyId: string, imageId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE property_images SET is_primary = false WHERE property_id = $1 AND is_primary = true",
        [propertyId],
      );
      await client.query("UPDATE property_images SET is_primary = true WHERE id = $1", [imageId]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
