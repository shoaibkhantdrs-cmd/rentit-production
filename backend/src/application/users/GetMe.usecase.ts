import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { toPublicUser } from "@/domain/entities/User";
import { NotFoundError } from "@/domain/errors/AppError";

export class GetMeUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const roles = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const preferences = await this.userPreferenceRepo.findByUserId(user.id);

    return { ...toPublicUser(user, roles), preferences };
  }
}
