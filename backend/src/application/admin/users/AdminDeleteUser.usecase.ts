import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { assertCanModerateUser } from "@/application/admin/shared/adminGuards";

export interface AdminDeleteUserInput {
  targetUserId: string;
  actorId: string;
  actorRoles: string[];
}

/** Admin-initiated equivalent of DeleteMeUseCase (Phase 2), targeting an
 * arbitrary user instead of "self". */
export class AdminDeleteUserUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: AdminDeleteUserInput): Promise<void> {
    if (input.targetUserId === input.actorId) {
      throw new ValidationError("Use your own account settings to delete your own account");
    }

    const target = await this.userRepo.findById(input.targetUserId);
    if (!target || target.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const targetRoles = await this.userRoleRepo.listRoleNamesForUser(target.id);
    assertCanModerateUser(targetRoles, input.actorRoles);

    await this.userRepo.softDelete(target.id);
    await this.refreshTokenRepo.revokeAllForUser(target.id, "admin_deleted");
    await this.sessionRepo.revokeAllForUser(target.id, "admin_deleted");

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.user.deleted",
      entityType: "user",
      entityId: target.id,
    });
  }
}
