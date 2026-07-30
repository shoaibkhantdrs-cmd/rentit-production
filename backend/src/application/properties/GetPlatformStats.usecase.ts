import { IPlatformStatsRepository, PlatformStats } from "@/domain/repositories/IPlatformStatsRepository";

/**
 * Backs the public homepage "Platform Statistics" redesign -- every
 * number shown there (Active Listings, Property Categories, Areas
 * Covered, Verified Owners) must be a real, currently-true aggregate, not
 * an invented figure (see the "no invented figures" convention already
 * established on HomePage.tsx's stats section). This is a thin
 * pass-through, mirroring GetDashboardStatsUseCase's shape, since all the
 * actual aggregation work belongs in the repository/read-model layer.
 */
export class GetPlatformStatsUseCase {
  constructor(private readonly statsRepo: IPlatformStatsRepository) {}

  async execute(): Promise<PlatformStats> {
    return this.statsRepo.getStats();
  }
}
