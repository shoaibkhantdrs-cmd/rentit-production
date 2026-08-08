import { IOwnerDashboardRepository, OwnerDashboardStats } from "@/domain/repositories/IOwnerDashboardRepository";

export interface GetOwnerDashboardStatsInput {
  ownerId: string;
}

/**
 * Phase 3 Part 3 (Owner Dashboard, must-have slice). Thin pass-through, the
 * same shape as GetPlatformStatsUseCase -- all the actual aggregation work
 * belongs in the repository/read-model layer. ownerId must always be the
 * authenticated caller's own id (see PropertyController.myStats); this use
 * case has no way to fetch another owner's stats since it takes no other
 * identifier.
 */
export class GetOwnerDashboardStatsUseCase {
  constructor(private readonly ownerDashboardRepo: IOwnerDashboardRepository) {}

  async execute(input: GetOwnerDashboardStatsInput): Promise<OwnerDashboardStats> {
    return this.ownerDashboardRepo.getStats(input.ownerId);
  }
}
