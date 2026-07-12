import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IRefreshTokenRepository } from "@/domain/repositories/IRefreshTokenRepository";
import { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { toPublicUser, User } from "@/domain/entities/User";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { assertCanModerateUser } from "@/application/admin/shared/adminGuards";

export interface UpdateUserStatusInput {
  targetUserId: string;
  status: User["status"]; // "active" (activate) | "suspended" (suspend) | "banned" (ban)
  actorId: string;
  actorRoles: string[];
  reason?: string;
}

/**
 * Backs "Suspend User", "Activate User" (Part 2), and "Ban User" (Part 4
 * Report Management) -- all three are the same operation on the same
 * `users.status` column, so one use-case serves all three UI actions
 * instead of three near-identical ones.
 */
export class UpdateUserStatusUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: UpdateUserStatusInput) {
    const target = await this.userRepo.findById(input.targetUserId);
    if (!target || target.deletedAt) {
      throw new NotFoundError("User not found");
    }

    if (input.targetUserId === input.actorId && input.status !== "active") {
      throw new ValidationError("You cannot suspend or ban your own account");
    }

    const targetRoles = await this.userRoleRepo.listRoleNamesForUser(target.id);
    assertCanModerateUser(targetRoles, input.actorRoles);

    const updated = await this.userRepo.update(target.id, { status: input.status });

    // Suspending/banning a user should end their active sessions immediately;
    // reactivating doesn't need to touch sessions (there are none to revoke).
    if (input.status !== "active") {
      await this.refreshTokenRepo.revokeAllForUser(target.id, `admin_status_change:${input.status}`);
      await this.sessionRepo.revokeAllForUser(target.id, `admin_status_change:${input.status}`);
    }

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: `admin.user.status_changed`,
      entityType: "user",
      entityId: target.id,
      metadata: { newStatus: input.status, reason: input.reason ?? null },
    });

    return toPublicUser(updated, targetRoles);
  }
}
