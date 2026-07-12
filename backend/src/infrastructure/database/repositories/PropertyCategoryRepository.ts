import { Pool } from "pg";
import { IPropertyCategoryRepository } from "@/domain/repositories/IPropertyCategoryRepository";
import { PropertyCategory } from "@/domain/entities/PropertyCategory";

interface PropertyCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function toEntity(row: PropertyCategoryRow): PropertyCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class PropertyCategoryRepository implements IPropertyCategoryRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<PropertyCategory | null> {
    const result = await this.pool.query<PropertyCategoryRow>(
      "SELECT * FROM property_categories WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<PropertyCategory | null> {
    const result = await this.pool.query<PropertyCategoryRow>(
      "SELECT * FROM property_categories WHERE slug = $1 AND deleted_at IS NULL",
      [slug],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findAll(): Promise<PropertyCategory[]> {
    const result = await this.pool.query<PropertyCategoryRow>(
      "SELECT * FROM property_categories WHERE deleted_at IS NULL ORDER BY name",
    );
    return result.rows.map(toEntity);
  }
}
