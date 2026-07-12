import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IUserPreferenceRepository } from "@/domain/repositories/IUserPreferenceRepository";
import { IActivityLogRepository } from "@/domain/repositories/IActivityLogRepository";
import { toPublicUser } from "@/domain/entities/User";
import { ConflictError, NotFoundError } from "@/domain/errors/AppError";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";

export interface UpdateMeInput {
  userId: string;
  name?: string;
  phone?: string | null;
  preferences?: {
    language?: string;
    timezone?: string;
    notifyEmail?: boolean;
    notifySms?: boolean;
    notifyPush?: boolean;
  };
}

export class UpdateMeUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly userPreferenceRepo: IUserPreferenceRepository,
    private readonly activityLogRepo: IActivityLogRepository,
    private readonly otpIssuer: OtpIssuer,
  ) {}

  async execute(input: UpdateMeInput) {
    const user = await this.userRepo.findById(input.userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const patch: Parameters<IUserRepository["update"]>[1] = {};

    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }

    let phoneChanged = false;
    if (input.phone !== undefined && input.phone !== user.phone) {
      if (input.phone) {
        const existing = await this.userRepo.findByPhone(input.phone);
        if (existing && existing.id !== user.id) {
          throw new ConflictError("This phone number is already in use");
        }
      }
      patch.phone = input.phone;
      // Changing the phone invalidates the previous verification.
      patch.phoneVerifiedAt = input.phone ? null : null;
      phoneChanged = true;
    }

    const updated = Object.keys(patch).length > 0 ? await this.userRepo.update(user.id, patch) : user;

    if (input.preferences) {
      await this.userPreferenceRepo.update(user.id, input.preferences);
    }

    await this.activityLogRepo.record({ userId: user.id, action: "profile.updated" });

    if (phoneChanged && updated.phone) {
      await this.otpIssuer.issue(updated, "phone_verification");
    }

    const roles = await this.userRoleRepo.listRoleNamesForUser(user.id);
    const preferences = await this.userPreferenceRepo.findByUserId(user.id);

    return { ...toPublicUser(updated, roles), preferences };
  }
}
