import { GrowthMetric, IAdminAnalyticsRepository } from "@/domain/repositories/IAdminAnalyticsRepository";
import { ValidationError } from "@/domain/errors/AppError";

export interface GetGrowthAnalyticsInput {
  metric: GrowthMetric;
  days: number;
}

const MAX_DAYS = 365;

export class GetGrowthAnalyticsUseCase {
  constructor(private readonly analyticsRepo: IAdminAnalyticsRepository) {}

  async execute(input: GetGrowthAnalyticsInput) {
    if (input.days < 1 || input.days > MAX_DAYS) {
      throw new ValidationError(`days must be between 1 and ${MAX_DAYS}`);
    }
    const points = await this.analyticsRepo.getGrowth(input.metric, input.days);
    return { metric: input.metric, days: input.days, points };
  }
}
