import { PremiumPlan } from "@/domain/entities/PremiumPlan";

export interface IPremiumPlanRepository {
  listActive(): Promise<PremiumPlan[]>;
  findById(id: string): Promise<PremiumPlan | null>;
  findBySlug(slug: string): Promise<PremiumPlan | null>;
}
