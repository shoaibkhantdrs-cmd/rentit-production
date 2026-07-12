import { IAdminAnalyticsRepository } from "@/domain/repositories/IAdminAnalyticsRepository";

export class GetDashboardStatsUseCase {
  constructor(private readonly analyticsRepo: IAdminAnalyticsRepository) {}

  async execute() {
    return this.analyticsRepo.getDashboardStats();
  }
}
