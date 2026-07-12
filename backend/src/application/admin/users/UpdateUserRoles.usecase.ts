import { IUserRepository } from "@/domain/repositories/IUserRepository";
import { IUserRoleRepository } from "@/domain/repositories/IUserRoleRepository";
import { IRoleRepository } from "@/domain/repositories/IRoleRepository";
import { IAuditLogRepository } from "@/domain/repositories/IAuditLogRepository";
import { toPublicUser } from "@/domain/entities/User";
import { NotFoundError, ValidationError } from "@/domain/errors/AppError";
import { assertCanModerateUser } from "@/application/admin/shared/adminGuards";

export interface UpdateUserRolesInput {
  targetUserId: string;
  roleNames: string[];
  actorId: string;
  actorRoles: string[];
}

/**
 * "Assign Roles" (Part 2): takes the desired *full* set of role names and
 * reconciles it against the user's current roles (assigning what's
 * missing, removing what's no longer wanted) in one call, rather than
 * exposing separate assign/remove endpoints the admin frontend would have
 * to diff itself.
 */
export class UpdateUserRolesUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly userRoleRepo: IUserRoleRepository,
    private readonly roleRepo: IRoleRepository,
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  async execute(input: UpdateUserRolesInput) {
    const target = await this.userRepo.findById(input.targetUserId);
    if (!target || target.deletedAt) {
      throw new NotFoundError("User not found");
    }

    const currentRoleNames = await this.userRoleRepo.listRoleNamesForUser(target.id);
    assertCanModerateUser(currentRoleNames, input.actorRoles);

    if (input.roleNames.includes("super_admin") && !input.actorRoles.includes("super_admin")) {
      throw new ValidationError("Only a super_admin can grant the super_admin role");
    }

    const desired = new Set(input.roleNames);
    const current = new Set(currentRoleNames);

    const toAdd = [...desired].filter((name) => !current.has(name));
    const toRemove = [...current].filter((name) => !desired.has(name));

    const allRoles = await this.roleRepo.findAll();
    const roleByName = new Map(allRoles.map((r) => [r.name, r]));

    for (const name of toAdd) {
      const role = roleByName.get(name);
      if (!role) {
        throw new ValidationError(`Unknown role: ${name}`);
      }
      await this.userRoleRepo.assign(target.id, role.id, input.actorId);
    }

    for (const name of toRemove) {
      const role = roleByName.get(name);
      if (role) {
        await this.userRoleRepo.remove(target.id, role.id);
      }
    }

    await this.auditLogRepo.record({
      userId: input.actorId,
      action: "admin.user.roles_updated",
      entityType: "user",
      entityId: target.id,
      metadata: { added: toAdd, removed: toRemove },
    });

    const updatedRoles = await this.userRoleRepo.listRoleNamesForUser(target.id);
    return toPublicUser(target, updatedRoles);
  }
}
