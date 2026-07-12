import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { NotFoundError } from "@/domain/errors/AppError";
import { OtpIssuer } from "@/application/auth/shared/OtpIssuer";
import { assertCanModerateUser } from "@/application/admin/shared/adminGuards";

export interface AdminResetUserPasswordInput {
  targetUserId: string;
  actorId: string;
  actorRoles: string[];
}

/**
 * "Reset Password" (Part 2): rather than an admin setting/knowing a new
 * password directly (which would mean the admin handles a plaintext
 * secret), this triggers the exact same password_reset OTP flow Phase 2
 * built for self-service "forgot password" -- the user receives a code by
 * email and sets their own new password via the existing
 * POST /auth/reset-password endpoint. The only difference from
 * ForgotPasswordUseCase is that an admin (not the user) initiated it, and
 * that's what gets audit-logged.
 */
export class AdminResetUserPasswordUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly otpIssuer: OtpIssuer,
  ) {}

  async execute(input: AdminResetUserPasswordInput): Promise<void> {
    const target = await this.userRepo.findById(input.targetUserId);
    if (!target || target.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const targetRoles = await this.userRoleRepo.listRoleNamesForUser(target.id);
    assertCanModerateUser(targetRoles, input.actorRoles);

    await this.otpIssuer.issue(target, "password_reset");

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.user.password_reset_triggered",
      entityType: "user",
      entityId: target.id,
    });
  }
}
