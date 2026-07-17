import { Pool } from "pg";
import { IPremiumPlanRepository } from "@/domain/repositories/IPremiumPlanRepository";
import { PremiumPlan } from "@/domain/entities/PremiumPlan";

interface PremiumPlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_amount: number;
  currency: string;
  duration_days: number;
  features: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function toEntity(row: PremiumPlanRow): PremiumPlan {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceAmount: row.price_amount,
    currency: row.currency,
    durationDays: row.duration_days,
    features: row.features,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PremiumPlanRepository implements IPremiumPlanRepository {
  constructor(private readonly pool: Pool) {}

  async listActive(): Promise<PremiumPlan[]> {
    const result = await this.pool.query<PremiumPlanRow>(
      "SELECT * FROM premium_plans WHERE is_active = true ORDER BY price_amount ASC",
    );
    return result.rows.map(toEntity);
  }

  async findById(id: string): Promise<PremiumPlan | null> {
    const result = await this.pool.query<PremiumPlanRow>(
      "SELECT * FROM premium_plans WHERE id = $1",
      [id],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<PremiumPlan | null> {
    const result = await this.pool.query<PremiumPlanRow>(
      "SELECT * FROM premium_plans WHERE slug = $1",
      [slug],
    );
    return result.rows[0] ? toEntity(result.rows[0]) : null;
  }
}
