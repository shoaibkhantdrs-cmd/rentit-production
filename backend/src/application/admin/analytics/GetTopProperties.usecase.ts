import { IAdminAnalyticsRepository } from "@/domain/repositories/IAdminAnalyticsRepository";
import { ValidationError } from "@/domain/errors/AppError";

export type TopPropertiesMetric = "most_viewed" | "most_favorited";

export interface GetTopPropertiesInput {
  metric: TopPropertiesMetric;
  limit: number;
}

const MAX_LIMIT = 50;

export class GetTopPropertiesUseCase {
  constructor(private readonly analyticsRepo: IAdminAnalyticsRepository) {}

  async execute(input: GetTopPropertiesInput) {
    if (input.limit < 1 || input.limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be between 1 and ${MAX_LIMIT}`);
    }

    const items =
      input.metric === "most_viewed"
        ? await this.analyticsRepo.getMostViewedProperties(input.limit)
        : await this.analyticsRepo.getMostFavoritedProperties(input.limit);

    return { metric: input.metric, items };
  }
}
