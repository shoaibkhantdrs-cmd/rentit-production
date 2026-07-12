import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IActivityLogRepository } from "@/domain/repositories/IActivityLogRepository";
import { IPropertyRepository } from "@/domain/repositories/IPropertyRepository";
import { toPublicUser } from "@/domain/entities/User";
import { NotFoundError } from "@/domain/errors/AppError";

const RECENT_ACTIVITY_COUNT = 10;

export class GetUserProfileUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly activityLogRepo: IActivityLogRepository,
    private readonly propertyRepo: IPropertyRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const [roles, preferences, recentActivity, propertyCounts] = await Promise.all([
      this.userRoleRepo.listRoleNamesForUser(user.id),
      this.userPreferenceRepo.findByUserId(user.id),
      this.activityLogRepo.listForUser(user.id, 1, RECENT_ACTIVITY_COUNT),
      this.propertyRepo.findByOwner(user.id, 1, 1),
    ]);

    return {
      ...toPublicUser(user, roles),
      preferences,
      propertyCount: propertyCounts.total,
      recentActivity: recentActivity.items,
    };
  }
}
