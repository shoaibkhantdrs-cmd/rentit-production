import { IPremiumPlanRepository } from "@/domain/repositories/IPremiumPlanRepository";
import { PremiumPlan } from "@/domain/entities/PremiumPlan";

export class ListPremiumPlansUseCase {
  constructor(private readonly premiumPlanRepo: IPremiumPlanRepository) {}

  async execute(): Promise<PremiumPlan[]> {
    return this.premiumPlanRepo.listActive();
  }
}
